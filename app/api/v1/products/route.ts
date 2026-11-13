import { getCatalogProducts, getCategoryBySlugOrId } from '@/lib/shop/queries'
import { localeFromRequest } from '@/lib/i18n/request-locale'
import { fail, ok, parsePositiveInt, sanitizeSearch } from '@/lib/api/helpers'
import { clientIp, isRateLimited } from '@/lib/api/rate-limit'

const ALLOWED_SORTS = ['new', 'price_asc', 'price_desc', 'popular'] as const
type Sort = (typeof ALLOWED_SORTS)[number]
const DEFAULT_PER_PAGE = 20
const MAX_PER_PAGE = 100

/**
 * Public catalog list for the store REST API v1 (Android shop app).
 *
 * GET /api/v1/products?q=&category=&sort=&page=&perPage=
 * - q: search term (sanitized, max 100 chars); absent = unfiltered listing.
 * - category: category slug or numeric id (resolved like the catalog page);
 *   unknown category -> 400.
 * - sort: new | price_asc | price_desc | popular; anything else -> 400.
 * - page: positive int, default 1. perPage: positive int, default 20, max 100.
 *
 * Shape and ordering reuse getCatalogProducts, so the app shows exactly what
 * the shop itself shows. NOTE: the shared query caps the effective perPage
 * at 48 (normalizeCatalogPaging) — the response echoes the effective values.
 */
export async function GET(request: Request) {
  if (await isRateLimited('v1-products', clientIp(request), 30)) {
    return fail('rate_limited', 429)
  }
  const { searchParams } = new URL(request.url)

  const q = sanitizeSearch(searchParams.get('q') ?? '')
    .trim()
    .slice(0, 100)

  const sortRaw = searchParams.get('sort')
  let sort: Sort | undefined
  if (sortRaw != null && sortRaw !== '') {
    if (!(ALLOWED_SORTS as readonly string[]).includes(sortRaw)) {
      return fail(`Некорректный sort. Допустимые: ${ALLOWED_SORTS.join(', ')}`, 400)
    }
    sort = sortRaw as Sort
  }

  const pageRaw = searchParams.get('page')
  let page = 1
  if (pageRaw != null && pageRaw !== '') {
    const parsed = parsePositiveInt(pageRaw)
    if (parsed == null) return fail('Некорректный page', 400)
    page = parsed
  }

  const perPageRaw = searchParams.get('perPage')
  let perPage = DEFAULT_PER_PAGE
  if (perPageRaw != null && perPageRaw !== '') {
    const parsed = parsePositiveInt(perPageRaw)
    if (parsed == null || parsed > MAX_PER_PAGE) return fail('Некорректный perPage', 400)
    perPage = parsed
  }

  const locale = localeFromRequest(request)

  let categoryId: number | undefined
  let category: { id: number; slug: string; name: string } | undefined
  const categoryRaw = searchParams.get('category')
  if (categoryRaw != null && categoryRaw !== '') {
    const resolved = await getCategoryBySlugOrId(categoryRaw, locale)
    if (!resolved) return fail('Категорія не знайдена', 400)
    categoryId = resolved.id
    category = { id: resolved.id, slug: resolved.slug, name: resolved.name }
  }

  const { items, total, page: effPage, perPage: effPerPage } = await getCatalogProducts({
    search: q || undefined,
    categoryId,
    sort,
    page,
    perPage,
    locale,
  })

  return ok({
    items: items.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      price: p.price,
      oldPrice: p.oldPrice,
      currency: p.currency,
      image: p.image,
      inStock: p.inStock,
      isPreorder: p.isPreorder,
      // Only when the request filtered by a category: the catalog query
      // carries no per-product category, and an N+1 lookup per item would
      // be pure overhead for a list.
      ...(category ? { category } : {}),
    })),
    total,
    page: effPage,
    perPage: effPerPage,
  })
}
