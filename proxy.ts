import { NextResponse, type NextRequest } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'
import { storefrontAuthShortcut } from '@/lib/shop/auth-shortcuts'

// Public storefront account routes that must stay reachable while logged out.
const PUBLIC_ACCOUNT_PATHS = ['/account/login', '/account/register', '/account/forgot-password']

function isProtectedAccountPath(pathname: string) {
  if (!pathname.startsWith('/account')) return false
  if (PUBLIC_ACCOUNT_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return false
  }
  return true
}

// On HTTPS deployments Better Auth prefixes its cookies with "__Secure-",
// while getSessionCookie() only checks the unprefixed name by default. Check
// both explicitly so production sessions are detected at the edge.
function hasSessionCookie(request: NextRequest) {
  if (getSessionCookie(request)) return true
  return (
    request.cookies.has('__Secure-better-auth.session_token') ||
    request.cookies.has('better-auth.session_token')
  )
}

// Storefront pages are bilingual: 'uk' (the default locale) is served
// unprefixed, 'ru' under a leading /ru segment (e.g. /ru/product/5). This is
// what makes both languages independently crawlable/indexable URLs instead of
// one URL whose content silently varies by cookie — see lib/i18n/server.ts.
// Admin, API, the one-time setup wizard and the admin sign-in page are not
// bilingual storefront content, so they're exempt from the /ru rewrite.
const LOCALE_EXEMPT_PREFIXES = ['/admin', '/api', '/sign-in', '/setup']

function isLocaleExempt(pathname: string) {
  return LOCALE_EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

const HSTS = 'max-age=31536000; includeSubDomains; preload'

function contentSecurityPolicy(nonce: string) {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    // Nonce + strict-dynamic: Next boot scripts and gtag.js (nonce on <Script>)
    // may load further scripts. Host allowlists on script-src are ignored once
    // a nonce is present in CSP3, so they only diluted the policy for scanners.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    // No blanket https: — catalog photos + Ads/GA pixels only.
    "img-src 'self' data: blob: https://images.prom.ua https://*.prom.ua https://cdn.prom.st https://*.prom.st https://*.public.blob.vercel-storage.com https://*.blob.vercel-storage.com https://images.unsplash.com https://www.google.com https://www.google.com.ua https://www.googletagmanager.com https://www.google-analytics.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.gstatic.com",
    "font-src 'self' data:",
    "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://www.google.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://stats.g.doubleclick.net https://region1.google-analytics.com https://images.prom.ua https://*.prom.ua https://*.prom.st https://*.vercel-storage.com https://*.blob.vercel-storage.com https://vitals.vercel-insights.com",
    "frame-src https://www.google.com https://www.googletagmanager.com https://td.doubleclick.net",
    'upgrade-insecure-requests',
  ].join('; ')
}

function withSecurityHeaders(response: NextResponse, nonce?: string) {
  response.headers.set('Strict-Transport-Security', HSTS)
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  if (nonce) response.headers.set('Content-Security-Policy', contentSecurityPolicy(nonce))
  return response
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  let locale: 'uk' | 'ru' = 'uk'
  let innerPathname = pathname
  if (!isLocaleExempt(pathname) && (pathname === '/ru' || pathname.startsWith('/ru/'))) {
    locale = 'ru'
    innerPathname = pathname.slice(3) || '/'
  }

  const shortcut = storefrontAuthShortcut(innerPathname)
  if (shortcut) {
    const dest = locale === 'ru' ? `/ru${shortcut}` : shortcut
    const url = request.nextUrl.clone()
    url.pathname = dest
    url.search = request.nextUrl.search
    url.hash = ''
    return withSecurityHeaders(NextResponse.redirect(url))
  }

  // Guard the protected storefront account area at the edge, before rendering.
  // Doing the auth check here (instead of a redirect() inside the async
  // AccountLayout) avoids aborting a Server Component mid-render, which the
  // React dev profiler mis-times and reports as a "negative time stamp" crash.
  // Checked against the un-prefixed path so it applies the same under /ru.
  if (isProtectedAccountPath(innerPathname)) {
    if (!hasSessionCookie(request)) {
      const loginPath = locale === 'ru' ? '/ru/account/login' : '/account/login'
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = loginPath
      loginUrl.search = ''
      loginUrl.hash = ''
      const redirectTo =
        pathname.startsWith('/') && !pathname.startsWith('//') ? pathname : '/account'
      loginUrl.searchParams.set('redirect', redirectTo)
      return withSecurityHeaders(NextResponse.redirect(loginUrl))
    }
  }

  // Expose the current pathname and resolved locale to server components via
  // request headers: the admin layout uses x-pathname for per-tab permission
  // checks, and lib/i18n/server.ts's getLocale() treats x-locale (derived from
  // the URL, not a cookie) as authoritative so the same URL always renders the
  // same language for every visitor, including crawlers with no cookies.
  const nonce = crypto.randomUUID().replace(/-/g, '')
  const csp = contentSecurityPolicy(nonce)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', innerPathname)
  requestHeaders.set('x-locale', locale)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  let response: NextResponse
  if (innerPathname !== pathname) {
    const url = request.nextUrl.clone()
    url.pathname = innerPathname
    response = NextResponse.rewrite(url, { request: { headers: requestHeaders } })
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } })
  }
  return withSecurityHeaders(response, nonce)
}

export const config = {
  matcher: [
    // Run on all paths except static assets and API auth routes.
    '/((?!_next/static|_next/image|favicon.ico|api/auth).*)',
  ],
}
