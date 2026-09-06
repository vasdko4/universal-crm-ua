import { DEFAULT_LOCALE, normalizeLocale, type Locale } from './config'

/**
 * Locale for public API routes. `/api` is not rewritten under `/ru`, so
 * x-locale from the page URL is missing unless the client (or proxy) forwards
 * it. Order: ?locale= → x-locale → Referer /ru → default uk.
 * Cookie is intentionally last-resort only via the caller (getLocale), never
 * here — a leftover locale=uk cookie must not override a /ru page.
 */
export function localeFromRequest(request: { url: string; headers: Headers }): Locale {
  const url = new URL(request.url)
  const fromQuery = url.searchParams.get('locale')
  if (fromQuery === 'ru' || fromQuery === 'uk') return fromQuery

  const fromHeader = request.headers.get('x-locale')
  if (fromHeader === 'ru' || fromHeader === 'uk') return fromHeader

  const referer = request.headers.get('referer')
  if (referer) {
    try {
      const path = new URL(referer).pathname
      if (path === '/ru' || path.startsWith('/ru/')) return 'ru'
    } catch {
      // ignore malformed referers
    }
  }

  return normalizeLocale(DEFAULT_LOCALE)
}
