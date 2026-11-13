import { getProductBySlug } from '@/lib/shop/queries'
import { extractBrand } from '@/lib/seo'
import { htmlToPlainText, normalizeGtin } from '@/lib/shop/google-merchant-feed'
import { localeFromRequest } from '@/lib/i18n/request-locale'
import { fail, ok } from '@/lib/api/helpers'
import { clientIp, isRateLimited } from '@/lib/api/rate-limit'

/**
 * Public product detail for the store REST API v1 (Android shop app).
 *
 * GET /api/v1/products/[slug] — the same product query the product page
 * uses (getProductBySlug), so the app sees exactly what the shop shows.
 * Only public fields are returned: never the raw `config` column or any
 * credentials (getProductBySlug does not select them).
 * Unknown slug -> 404.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (await isRateLimited('v1-product', clientIp(request), 60)) {
    return fail('rate_limited', 429)
  }
  const { slug } = await params
  if (!slug) return fail('Товар не знайдено', 404)
  const locale = localeFromRequest(request)
  const found = await getProductBySlug(slug, locale)
  if (!found) return fail('Товар не знайдено', 404)
  const { product, characteristics, categories } = found
  const gtin = normalizeGtin(product.barcode)
  const brand = extractBrand(characteristics)
  const category = categories[0]
  return ok({
    id: product.id,
    slug: product.slug,
    name: product.name,
    // Plain text, capped at 500 chars like the product page's JSON-LD;
    // null when the product has no description (no generated filler).
    description: product.description ? htmlToPlainText(product.description).slice(0, 500) : null,
    price: product.price,
    oldPrice: product.oldPrice,
    currency: product.currency,
    sku: product.sku,
    brand,
    image: product.image,
    images: product.images,
    characteristics: characteristics.map((c) => ({ name: c.name, value: c.value })),
    ...(category ? { category: { id: category.id, slug: category.slug, name: category.name } } : {}),
    inStock: product.inStock,
    isPreorder: product.isPreorder,
    ...(gtin ? { gtin } : {}),
  })
}
