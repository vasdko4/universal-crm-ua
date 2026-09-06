'use client'

import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { LOCALE_COOKIE, type Locale } from './config'
import { getDictionary, type Dictionary } from './dictionaries'

export type { Locale }

type I18nContextValue = {
  locale: Locale
  dict: Dictionary
}

const I18nContext = createContext<I18nContextValue | null>(null)

const LOCALE_EVENT = 'v0-locale-change'

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
  // The URL (via proxy.ts → x-locale → this server `locale` prop) is the
  // source of truth. Reading the cookie here used to override /ru pages with
  // Ukrainian chrome whenever the visitor still had locale=uk from a previous
  // visit (logo → /, bottom nav "Головна/Категорії/Кошик", footer "Нд").
  // Cookie is still written by persistLocaleClientSide for first-visit modal
  // and server-action fallbacks; language switches navigate to /ru or /.
  const dict = getDictionary(locale)
  useEffect(() => {
    persistLocaleClientSide(locale)
  }, [locale])
  return (
    <I18nContext.Provider value={{ locale, dict }}>{children}</I18nContext.Provider>
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
