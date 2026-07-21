'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { LOCALE_COOKIE, normalizeLocale, type Locale } from './config'
import { getDictionary, type Dictionary } from './dictionaries'

export type { Locale }

type I18nContextValue = {
  locale: Locale
  dict: Dictionary
}

const I18nContext = createContext<I18nContextValue | null>(null)

const LOCALE_EVENT = 'v0-locale-change'

function readLocaleCookie(): Locale | null {
  if (typeof document === 'undefined') return null
  const raw = document.cookie.split('; ').find((c) => c.startsWith(`${LOCALE_COOKIE}=`))
  if (!raw) return null
  return normalizeLocale(raw.split('=')[1])
}

/**
 * Writes the locale cookie directly on the client and notifies all mounted
 * LocaleProviders. Keeps the choice safe even when the server action response
 * is lost (proxy caches, race with navigation), and switches the UI instantly.
 */
export function persistLocaleClientSide(locale: Locale) {
  if (typeof document === 'undefined') return
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
  window.dispatchEvent(new CustomEvent(LOCALE_EVENT, { detail: locale }))
}

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale
  children: ReactNode
}) {
  const [activeLocale, setActiveLocale] = useState<Locale>(locale)

  // Server HTML can come from a cache rendered before (or with a different)
  // locale cookie — e.g. behind an nginx proxy cache. After hydration, trust
  // the client cookie as the source of truth and correct the UI language.
  useEffect(() => {
    const fromCookie = readLocaleCookie()
    setActiveLocale((current) => (fromCookie && fromCookie !== current ? fromCookie : current))
  }, [locale])

  // Instant switch when the user picks a language anywhere on the page.
  useEffect(() => {
    const onChange = (e: Event) => {
      const next = normalizeLocale((e as CustomEvent<string>).detail)
      setActiveLocale(next)
    }
    window.addEventListener(LOCALE_EVENT, onChange)
    return () => window.removeEventListener(LOCALE_EVENT, onChange)
  }, [])

  const dict = getDictionary(activeLocale)
  return (
    <I18nContext.Provider value={{ locale: activeLocale, dict }}>{children}</I18nContext.Provider>
  )
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    // Safe fallback so components never crash outside the provider.
    return { locale: 'uk', dict: getDictionary('uk') }
  }
  return ctx
}

export { pickLocalized } from './config'
