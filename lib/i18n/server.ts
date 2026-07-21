import { cookies, headers } from 'next/headers'
import { DEFAULT_LOCALE, LOCALE_COOKIE, normalizeLocale, type Locale } from './config'
import { getDictionary } from './dictionaries'

/**
 * Resolves the active locale for the current request (server components /
 * actions / route handlers).
 *
 * The `x-locale` header — set by proxy.ts from the /ru URL prefix — is
 * authoritative when present: it makes the rendered language a pure function
 * of the URL, so the same URL always renders the same content for every
 * visitor, including search-engine crawlers that never carry cookies. This is
 * what makes /ru/... a real, independently indexable language version instead
 * of the same URL silently varying by cookie. Falls back to the locale cookie
 * for anything proxy.ts doesn't rewrite (e.g. server actions invoked without
 * a matching page request), and finally to the default locale (uk).
 */
export async function getLocale(): Promise<Locale> {
  const h = await headers()
  const fromUrl = h.get('x-locale')
  if (fromUrl) return normalizeLocale(fromUrl)
  const store = await cookies()
  return normalizeLocale(store.get(LOCALE_COOKIE)?.value)
}

/** Whether the visitor has explicitly chosen a locale (drives the first-visit modal). */
export async function hasLocaleCookie(): Promise<boolean> {
  const store = await cookies()
  return store.get(LOCALE_COOKIE)?.value != null
}

export async function getServerDictionary() {
  const locale = await getLocale()
  return { locale, dict: getDictionary(locale) }
}

export { DEFAULT_LOCALE, getDictionary }
