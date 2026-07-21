export type Locale = 'uk' | 'ru'

export const LOCALES: Locale[] = ['uk', 'ru']
export const DEFAULT_LOCALE: Locale = 'uk'
export const LOCALE_COOKIE = 'locale'

export function isLocale(value: string | undefined | null): value is Locale {
  return value === 'uk' || value === 'ru'
}

export function normalizeLocale(value: string | undefined | null): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE
}

/**
 * Prefixes a site-relative path with the /ru segment for the 'ru' locale.
 * 'uk' (the default locale) is never prefixed. Use this for every internal
 * link so navigating around the site keeps the visitor on URLs in the
 * language they're currently reading — required for /ru pages to be
 * reachable via on-site links (and not just directly via the sitemap), and
 * for language-switching to actually change the URL instead of only a cookie.
 */
export function localizedPath(path: string, locale: Locale): string {
  if (locale !== 'ru') return path
  if (path === '/') return '/ru'
  return `/ru${path.startsWith('/') ? '' : '/'}${path}`
}

/** Strips a leading /ru locale prefix from a path, if present. */
export function stripLocalePrefix(path: string): string {
  if (path === '/ru') return '/'
  if (path.startsWith('/ru/')) return path.slice(3)
  return path
}

export const LOCALE_LABELS: Record<Locale, string> = {
  uk: 'Українська',
  ru: 'Русский',
}

export const LOCALE_SHORT: Record<Locale, string> = {
  uk: 'Укр',
  ru: 'Рус',
}

/** Pick a localized value from bilingual DB fields with fallback. */
export function pickLocalized(
  locale: Locale,
  uk: string | null | undefined,
  ru: string | null | undefined,
): string {
  if (locale === 'ru') return ru || uk || ''
  return uk || ru || ''
}
