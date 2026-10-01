'use client'

import { useSyncExternalStore } from 'react'

const TOKEN_KEY = 'setup-token'

function readSetupToken(): string {
  if (typeof window === 'undefined') return ''
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('token') ?? ''
    if (fromUrl) return fromUrl
    return sessionStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

function getServerSnapshot(): string {
  return ''
}

// The setup token never changes after mount (it is a one-shot value read from
// the URL or sessionStorage), so there is nothing to subscribe to — the
// no-op subscribe only satisfies the useSyncExternalStore contract.
function subscribeNoop(): () => void {
  return () => {}
}

/**
 * One-shot setup token from `?token=` or sessionStorage, read as an external
 * store. Uses the server snapshot during SSR/hydration, so unlike a
 * useState-initializer or a mount effect with setState it can neither cause a
 * hydration mismatch nor trigger the set-state-in-effect lint.
 */
export function useSetupToken(): string {
  return useSyncExternalStore(subscribeNoop, readSetupToken, getServerSnapshot)
}

export { TOKEN_KEY as SETUP_TOKEN_KEY }
