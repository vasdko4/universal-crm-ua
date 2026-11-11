// Pure validation helpers for the public /api/track endpoint. Kept
// side-effect free so unit tests can import them without the DB pool or
// a Next.js request context.

/**
 * A shop pathname: must start with '/' (never an absolute URL, and never
 * protocol-relative '//host'). Legit paths come from Next's usePathname(),
 * which always starts with '/'; anything else is garbage or a forgery
 * attempt aimed at the top-paths report.
 */
export function isValidTrackPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//')
}

/**
 * The client-supplied referrer is untrusted: keep it only when it parses as
 * an http(s) URL, otherwise drop it (null). A forged but well-formed URL
 * still passes — that residual forgery is what the "орієнтовно" note on the
 * statistics dashboard discloses; the signed visit-id design (follow-up)
 * is what would close it.
 *
 * NOTE: the request's own Referer header is deliberately NOT used here.
 * For a fetch/beacon to /api/track it is the shop page URL itself
 * (same-origin), not the external traffic source, so storing it would make
 * every pageview report the shop as its own source.
 */
export function normalizeTrackReferrer(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  } catch {
    return null
  }
  return value.slice(0, 300)
}
