'use client'

import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react'
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

function subscribeToLocaleChange(callback: () => void) {
  window.addEventListener(LOCALE_EVENT, callback)
  return () => window.removeEventListener(LOCALE_EVENT, callback)
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
  // Server HTML can come from a cache rendered before (or with a different)
  // locale cookie — e.g. behind an nginx proxy cache — so the client cookie
  // is the real source of truth once we can read it, and an in-page locale
  // switch should update instantly everywhere. `useSyncExternalStore` covers
  // both: it re-reads the cookie whenever the LOCALE_EVENT fires (dispatched
  // by persistLocaleClientSide right after writing the cookie), and falls
  // back to the server-rendered `locale` prop for the SSR snapshot.
  const activeLocale = useSyncExternalStore(
    subscribeToLocaleChange,
    () => readLocaleCookie() ?? locale,
    () => locale,
  )

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
