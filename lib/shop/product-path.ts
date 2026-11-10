/**
 * Extracts the product slug from a storefront path recorded in analytics,
 * e.g. `/product/iphone-15` or `/ru/product/iphone-15` → `iphone-15`.
 * Returns null for any other page (homepage, account, categories, …).
 */
export function extractProductSlug(path: string | null | undefined): string | null {
  if (!path) return null
  const clean = path.split(/[?#]/, 1)[0].trim()
  if (!clean) return null
  const match = clean.match(/^\/(?:uk\/|ru\/)?product\/([^/]+)\/?$/)
  if (!match) return null
  const slug = match[1].trim()
  return slug ? slug : null
}
