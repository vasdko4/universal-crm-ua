'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Locale } from '@/lib/i18n/config'
import { getAdminDictionary, type AdminDictionary } from './dictionaries'

type AdminI18nValue = {
  locale: Locale
  dict: AdminDictionary
  /** Updates the UI instantly after the language switcher saves to the DB. */
  setLocale: (locale: Locale) => void
}

const AdminI18nContext = createContext<AdminI18nValue | null>(null)

/**
 * Admin-center locale provider. Unlike the storefront's LocaleProvider, the
 * initial locale here comes from the signed-in admin's DB record (user.locale
 * — see lib/session.ts), not a cookie: the language is tied to the account,
 * so it's already correct on first paint for every admin, on every device,
 * without asking again.
 */
export function AdminLocaleProvider({
  locale,
  children,
}: {
  locale: Locale
  children: ReactNode
}) {
  const [activeLocale, setActiveLocale] = useState<Locale>(locale)
  const dict = getAdminDictionary(activeLocale)
  return (
    <AdminI18nContext.Provider value={{ locale: activeLocale, dict, setLocale: setActiveLocale }}>
      {children}
    </AdminI18nContext.Provider>
  )
}

export function useAdminI18n(): AdminI18nValue {
  const ctx = useContext(AdminI18nContext)
  if (!ctx) {
    // Safe fallback so components never crash if rendered outside the
    // provider (e.g. in isolated tests).
    const dict = getAdminDictionary('ru')
    return { locale: 'ru', dict, setLocale: () => {} }
  }
  return ctx
}
