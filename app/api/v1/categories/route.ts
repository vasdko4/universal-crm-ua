import { getShopCategories } from '@/lib/shop/queries'
import { localeFromRequest } from '@/lib/i18n/request-locale'
import { fail, ok } from '@/lib/api/helpers'
import { clientIp, isRateLimited } from '@/lib/api/rate-limit'

/**
 * Public category list for the store REST API v1 (Android shop app).
 *
 * GET /api/v1/categories — the active categories the catalog shows, in the
 * shop's sort order (getShopCategories). No product counts: there is no
 * existing count query to reuse, and a per-category aggregate is out of
 * scope for the read-only v1 catalog slice.
 */
export async function GET(request: Request) {
  if (await isRateLimited('v1-categories', clientIp(request), 60)) {
    return fail('rate_limited', 429)
  }
  const locale = localeFromRequest(request)
  const categories = await getShopCategories(locale)
  return ok(categories.map((c) => ({ id: c.id, slug: c.slug, name: c.name })))
}
