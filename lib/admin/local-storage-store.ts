/**
 * A tiny external store for one localStorage key, built for
 * `useSyncExternalStore`.
 *
 * Why not `useState` + `useEffect` (read on mount, then setState)? React
 * flags that pattern (react-hooks/set-state-in-effect): the effect fires
 * after paint, so the first paint always shows the fallback and a second
 * render follows. `useSyncExternalStore` is the documented solution for
 * browser-store-backed state: it hydrates with the server snapshot and
 * re-reads the client snapshot without a hydration mismatch, and it
 * notifies subscribers when the key changes in another tab.
 *
 * Snapshot stability: `getSnapshot` returns the same array/object reference
 * while the stored raw string is unchanged, so React does not loop. Writes
 * go through `set`, which persists and notifies listeners in this tab; the
 * `storage` event covers other tabs. When the write itself fails (private
 * mode, quota), the value still updates for this session.
 */

export type LocalStorageStore<T> = {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => T
  getServerSnapshot: () => T
  set: (next: T) => void
}

export function createLocalStorageStore<T>(options: {
  key: string
  parse: (raw: string | null) => T
  serialize: (value: T) => string
  fallback: T
}): LocalStorageStore<T> {
  const { key, parse, serialize, fallback } = options
  const listeners = new Set<() => void>()
  // `undefined` = never read yet.
  let cachedRaw: string | null | undefined
  let cachedValue: T | undefined
  let writeFailed = false

  function getSnapshot(): T {
    // A failed write leaves the session-only value in place.
    if (writeFailed && cachedValue !== undefined) return cachedValue
    let raw: string | null = null
    try {
      raw = window.localStorage.getItem(key)
    } catch {
      return cachedValue ?? fallback
    }
    if (raw === cachedRaw && cachedValue !== undefined) return cachedValue
    cachedRaw = raw
    try {
      cachedValue = parse(raw)
    } catch {
      cachedValue = fallback
    }
    return cachedValue
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) listeners.forEach((l) => l())
    }
    window.addEventListener('storage', onStorage)
    return () => {
      listeners.delete(listener)
      window.removeEventListener('storage', onStorage)
    }
  }

  function set(next: T): void {
    cachedValue = next
    try {
      const raw = serialize(next)
      window.localStorage.setItem(key, raw)
      cachedRaw = raw
      writeFailed = false
    } catch {
      // Storage unavailable — the value still updates for this session.
      writeFailed = true
    }
    listeners.forEach((l) => l())
  }

  return {
    subscribe,
    getSnapshot,
    getServerSnapshot: () => fallback,
    set,
  }
}
