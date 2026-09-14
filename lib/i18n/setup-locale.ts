'use client'

import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from './config'
import { persistLocaleClientSide } from './client'
import { getSetupDictionary, type SetupDictionary } from './setup'

function readLocaleCookie(): Locale {
  if (typeof document === 'undefined') return DEFAULT_LOCALE
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`))
  const value = match?.[1]
  return isLocale(value) ? value : DEFAULT_LOCALE
}

export function useSetupLocale(): {
  locale: Locale
  t: SetupDictionary
  setLocale: (locale: Locale) => void
} {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

  useEffect(() => {
    setLocaleState(readLocaleCookie())
  }, [])

  const setLocale = useCallback((next: Locale) => {
    persistLocaleClientSide(next)
    setLocaleState(next)
  }, [])

  return { locale, t: getSetupDictionary(locale), setLocale }
}
