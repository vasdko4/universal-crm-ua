import { getActivePromotions, getPromotionProducts } from '@/lib/shop/queries'
import { localeFromRequest } from '@/lib/i18n/request-locale'
import { fail, ok } from '@/lib/api/helpers'
import { clientIp, isRateLimited } from '@/lib/api/rate-limit'

/**
 * Public list of live automatic-discount campaigns for the store REST API v1
 * (Android shop app, promotions showcase).
 *
 * GET /api/v1/promotions
 * - No auth, no query params. Locale via localeFromRequest (?locale= /
 *   x-locale / Referer /ru, default uk) — product names follow the site.
 *
 * Data source is exactly the web /promotions page: getActivePromotions()
 * (active automatic discounts, started, not ended; endsAt null = open-ended;
 * promocodes are type 'promocode' and never match) plus
 * getPromotionProducts(promo, 8, locale) per campaign.
 *
 * Honesty rule (3.4.103): an automatic discount changes ONLY the checkout
 * total — it is never applied to the displayed price. So the response carries
 * the promo % / fixed amount and the plain product prices, and NO discounted
 * price is ever computed here; the app shows the promo as a checkout discount.
 *
 * Response: [{ id, name, type: "percent" | "fixed", value, startsAt, endsAt,
 *   products: [{ id, name, price, oldPrice, image }] }] — soonest-ending
 * first (dated promos before open-ended, same order as the web page/banner),
 * empty array when no live promos.
 */
export async function GET(request: Request) {
  if (await isRateLimited('v1-promotions', clientIp(request), 30)) {
    return fail('rate_limited', 429)
  }

  const locale = localeFromRequest(request)
  const promotions = await getActivePromotions()
  const withProducts = await Promise.all(
    promotions.map(async (promo) => ({
      promo,
      products: await getPromotionProducts(promo, 8, locale),
    })),
  )

  return ok(
    withProducts.map(({ promo, products }) => ({
      id: promo.id,
      name: promo.name,
      type: promo.discountType === 'percentage' ? 'percent' : 'fixed',
      value: promo.discountValue,
      startsAt: promo.startsAt,
      endsAt: promo.endsAt,
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        oldPrice: p.oldPrice,
        image: p.image,
      })),
    })),
  )
}
