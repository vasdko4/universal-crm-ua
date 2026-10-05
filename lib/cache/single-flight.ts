/**
 * Single-flight: coalesce concurrent identical async recomputations.
 * When N requests trigger the same cache refresh at once (thundering herd
 * after TTL expiry), only the first one runs the work — the rest await its
 * promise. Entries are removed as soon as they settle, so this only dedupes
 * *concurrent* calls, never serves stale results.
 */
const inflight = new Map<string, Promise<unknown>>()

export function singleFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const running = inflight.get(key)
  if (running) return running as Promise<T>
  const p: Promise<T> = fn().finally(() => {
    if (inflight.get(key) === p) inflight.delete(key)
  })
  inflight.set(key, p)
  return p
}
