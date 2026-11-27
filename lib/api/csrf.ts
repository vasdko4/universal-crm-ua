import { NextResponse } from 'next/server'

/**
 * Origin-based CSRF guard for state-changing API routes (3.4.109, audit #5).
 *
 * A cross-site form/fetch from an attacker's page runs in the victim's
 * browser with the victim's cookies, so cookie-authenticated handlers must
 * refuse requests whose Origin is not this shop. Rules, in order:
 *
 *   1. No Origin header → allowed. Non-browser clients (curl, the Android
 *      app, server-to-server calls) send none, and a same-origin
 *      navigation/form POST from an old browser may omit it too. The
 *      ambient-auth risk comes from browsers, which always send Origin on
 *      cross-origin POST/PUT/PATCH/DELETE.
 *   2. Origin equal to the request URL's origin → allowed (same-origin,
 *      including dev http://localhost:3000).
 *   3. Origin matching a configured public origin → allowed. Mirrors the
 *      trustedOrigins list in lib/auth.ts (BETTER_AUTH_URL / APP_URL for
 *      self-hosted behind a proxy, Vercel project URLs, V0 runtime URL),
 *      so a shop behind a TLS-terminating proxy — where req.url is the
 *      internal 127.0.0.1:3000 origin — still accepts its public domain.
 *      `*.` entries match any subdomain of that suffix.
 *   4. Anything else (including a malformed Origin) → 403.
 *
 * Deliberately NOT wired into: app/api/auth/[...all] (Better Auth enforces
 * trustedOrigins itself), the Monobank/WayForPay callbacks (HMAC-signed,
 * no cookie auth — a forged Origin there is meaningless), the WayForPay
 * return page (resolves an order ref and 303-redirects only, no mutation),
 * and the cron routes (GET-only + CRON_SECRET bearer auth, CSRF N/A).
 * Server actions are covered by Next.js' own Origin check and are out of
 * scope here — this helper is for route handlers only.
 *
 * Pure function of (request, env): no DB, no imports beyond next/server,
 * so it is unit-testable without mocks.
 */
export function csrfCheck(req: Request): NextResponse | null {
  const origin = req.headers.get('origin')
  if (!origin) return null
  if (isAllowedOrigin(origin, req.url)) return null
  return NextResponse.json({ error: 'Заборонено: недійсний Origin' }, { status: 403 })
}

function originOf(value: string): string | null {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

/** Configured public origins, read at call time (mirrors lib/auth.ts trustedOrigins). */
export function configuredAllowedOrigins(): string[] {
  const out: string[] = []
  if (process.env.BETTER_AUTH_URL) out.push(process.env.BETTER_AUTH_URL)
  if (process.env.APP_URL) out.push(process.env.APP_URL)
  if (process.env.V0_RUNTIME_URL) {
    out.push('https://*.vusercontent.net', 'https://*.v0.dev', process.env.V0_RUNTIME_URL)
  }
  if (process.env.VERCEL) {
    if (process.env.VERCEL_URL) out.push(`https://${process.env.VERCEL_URL}`)
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
      out.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
    }
    if (process.env.VERCEL_BRANCH_URL) out.push(`https://${process.env.VERCEL_BRANCH_URL}`)
  }
  return out
}

function matchesAllowedOrigin(origin: string, allowed: string): boolean {
  const allowedOrigin = originOf(allowed)
  if (!allowedOrigin) return false
  if (allowedOrigin === origin) return true
  // Wildcard entry such as https://*.v0.dev: same scheme, hostname is a
  // subdomain of the suffix.
  const m = /^([a-z]+:\/\/)\*\.(.+)$/i.exec(allowedOrigin)
  if (!m) return false
  let parsed: URL
  try {
    parsed = new URL(origin)
  } catch {
    return false
  }
  return `${parsed.protocol}//` === m[1].toLowerCase() && parsed.hostname.endsWith(`.${m[2].toLowerCase()}`)
}

export function isAllowedOrigin(origin: string, requestUrl: string): boolean {
  const parsed = originOf(origin)
  if (!parsed) return false
  if (parsed === originOf(requestUrl)) return true
  return configuredAllowedOrigins().some((allowed) => matchesAllowedOrigin(parsed, allowed))
}
