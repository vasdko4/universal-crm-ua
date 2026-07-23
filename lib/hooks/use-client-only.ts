'use client'

import { useSyncExternalStore } from 'react'

// There's nothing to subscribe to here — these values never change after
// hydration — so the subscribe function is a no-op.
function subscribeNoop() {
  return () => {}
}

/**
 * True only once the component has actually mounted on the client.
 *
 * Prefer this over `useState(false)` + `useEffect(() => setState(true), [])`:
 * that pattern calls setState synchronously inside an effect body (flagged
 * by the react-hooks/set-state-in-effect rule) even though it's really just
 * reading a value that differs between the server and the client.
 * `useSyncExternalStore` is the primitive React itself recommends for this —
 * same two-pass SSR-safe behavior (false on the server / first render, true
 * after hydration), no effect required.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(subscribeNoop, () => true, () => false)
}

/**
 * `window.location.origin` on the client, `fallback` during SSR / before
 * hydration. See {@link useIsClient} for why `useSyncExternalStore` (instead
 * of state + an effect) is used here.
 */
export function useClientOrigin(fallback = ''): string {
  return useSyncExternalStore(subscribeNoop, () => window.location.origin, () => fallback)
}
