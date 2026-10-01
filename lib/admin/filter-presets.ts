/**
 * Saved filter presets for admin list pages (orders, products, ...).
 *
 * Presets are stored in localStorage so each staff member keeps their own
 * set. The helpers below are storage-agnostic (they accept a minimal
 * key-value interface) so they stay unit-testable in a node environment.
 */

export interface FilterPreset<F> {
  id: string
  name: string
  filters: F
}

/** Minimal subset of the Web Storage API used by the preset helpers. */
export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function isValidPreset<F>(value: unknown): value is FilterPreset<F> {
  if (!value || typeof value !== 'object') return false
  const p = value as Record<string, unknown>
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    !!p.filters &&
    typeof p.filters === 'object'
  )
}

/** Load saved presets for a storage key. Never throws. */
export function loadFilterPresets<F>(
  storage: KeyValueStorage,
  storageKey: string,
): FilterPreset<F>[] {
  try {
    const raw = storage.getItem(storageKey)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((p) => isValidPreset<F>(p))
  } catch {
    return []
  }
}

/** Persist presets for a storage key. Never throws (quota / private mode). */
export function persistFilterPresets<F>(
  storage: KeyValueStorage,
  storageKey: string,
  presets: FilterPreset<F>[],
): void {
  try {
    storage.setItem(storageKey, JSON.stringify(presets))
  } catch {
    // Storage unavailable (private mode, quota) — presets just don't persist.
  }
}

/**
 * Append a new preset. Returns the updated list; returns the original list
 * unchanged when the name is blank.
 */
export function addFilterPreset<F>(
  presets: FilterPreset<F>[],
  name: string,
  filters: F,
): FilterPreset<F>[] {
  const trimmed = name.trim()
  if (!trimmed) return presets
  const id = crypto.randomUUID()
  return [...presets, { id, name: trimmed, filters }]
}

/** Remove a preset by id. Returns the updated list. */
export function removeFilterPreset<F>(
  presets: FilterPreset<F>[],
  id: string,
): FilterPreset<F>[] {
  return presets.filter((p) => p.id !== id)
}
