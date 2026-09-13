/**
 * Short / legacy storefront URLs. Applied in proxy.ts as real redirects
 * (not rewrites) so the address bar matches the actual account routes.
 */
const AUTH_SHORTCUTS: Record<string, string> = {
  '/login': '/account/login',
  '/register': '/account/register',
  '/signup': '/account/register',
  '/account/profile': '/account',
  '/account/favorites': '/favorites',
  '/account/wishlist': '/favorites',
}

export function storefrontAuthShortcut(pathname: string): string | null {
  return AUTH_SHORTCUTS[pathname] ?? null
}
