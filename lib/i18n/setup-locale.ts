'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from './config'
import { persistLocaleClientSide } from './client'
import { getSetupDictionary, type SetupDictionary } from './setup'

function readLocaleCookie(): Locale {
  if (typeof document === 'undefined') return DEFAULT_LOCALE
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`))
  const value = match?.[1]
  return isLocale(value) ? value : DEFAULT_LOCALE
}

// The locale cookie is an external store (browser-only). useSyncExternalStore
// reads it with the server snapshot during SSR/hydration, so the client never
// renders a mismatched locale and no mount effect with setState is needed.
const localeListeners = new Set<() => void>()

function subscribeLocale(listener: () => void): () => void {
  localeListeners.add(listener)
  return () => {
    localeListeners.delete(listener)
  }
}

function getLocaleServerSnapshot(): Locale {
  return DEFAULT_LOCALE
}

export function useSetupLocale(): {
  locale: Locale
  t: SetupDictionary
  setLocale: (locale: Locale) => void
} {
  const locale = useSyncExternalStore(subscribeLocale, readLocaleCookie, getLocaleServerSnapshot)

  const setLocale = useCallback((next: Locale) => {
    persistLocaleClientSide(next)
    localeListeners.forEach((listener) => listener())
  }, [])

  return { locale, t: getSetupDictionary(locale), setLocale }
}
