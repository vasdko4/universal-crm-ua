import { NextResponse, type NextRequest } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  let locale: 'uk' | 'ru' = 'uk'
  let innerPathname = pathname
  if (!isLocaleExempt(pathname) && (pathname === '/ru' || pathname.startsWith('/ru/'))) {
    locale = 'ru'
    innerPathname = pathname.slice(3) || '/'
  }

  // Guard the protected storefront account area at the edge, before rendering.
  // Doing the auth check here (instead of a redirect() inside the async
  // AccountLayout) avoids aborting a Server Component mid-render, which the
  // React dev profiler mis-times and reports as a "negative time stamp" crash.
  // Checked against the un-prefixed path so it applies the same under /ru.
  if (isProtectedAccountPath(innerPathname)) {
    if (!hasSessionCookie(request)) {
      const loginPath = locale === 'ru' ? '/ru/account/login' : '/account/login'
      const loginUrl = new URL(loginPath, request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // Expose the current pathname and resolved locale to server components via
  // request headers: the admin layout uses x-pathname for per-tab permission
  // checks, and lib/i18n/server.ts's getLocale() treats x-locale (derived from
  // the URL, not a cookie) as authoritative so the same URL always renders the
  // same language for every visitor, including crawlers with no cookies.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', innerPathname)
  requestHeaders.set('x-locale', locale)

  if (innerPathname !== pathname) {
    const url = request.nextUrl.clone()
    url.pathname = innerPathname
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } })
  }

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: [
    // Run on all paths except static assets and API auth routes.
    '/((?!_next/static|_next/image|favicon.ico|api/auth).*)',
  ],
}
