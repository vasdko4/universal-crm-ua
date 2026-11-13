import { eq } from 'drizzle-orm'
import { type NextRequest } from 'next/server'
import { submitReview } from '@/app/actions/shop'
import { db } from '@/lib/db'
import { orders } from '@/lib/db/schema'
import { fail, ok, parsePositiveInt, readJson } from '@/lib/api/helpers'
import { clientIp, isRateLimited } from '@/lib/api/rate-limit'
import { sanitizeContent } from '@/lib/shop/sanitize'
import { summarizeReviews } from '@/lib/shop/review-summary'
import { getApprovedReviews, getProductBySlug } from '@/lib/shop/queries'

const LIST_MAX_PER_MIN = 60
const SUBMIT_MAX_PER_MIN = 5
const DEFAULT_PER_PAGE = 20
const MAX_PER_PAGE = 100
const MAX_NAME_LENGTH = 120
const MAX_TEXT_LENGTH = 5000

type RouteParams = { params: Promise<{ slug: string }> }

function parseListParams(req: NextRequest): { page: number; perPage: number } | { error: string } {
  const sp = new URL(req.url).searchParams
  let page = 1
  const pageRaw = sp.get('page')
  if (pageRaw != null && pageRaw !== '') {
    const parsed = parsePositiveInt(pageRaw)
    if (parsed == null) return { error: 'Некорректний page' }
    page = parsed
  }
  let perPage = DEFAULT_PER_PAGE
  const perPageRaw = sp.get('perPage')
  if (perPageRaw != null && perPageRaw !== '') {
    const parsed = parsePositiveInt(perPageRaw)
    if (parsed == null || parsed > MAX_PER_PAGE) return { error: 'Некорректний perPage' }
    perPage = parsed
  }
  return { page, perPage }
}

/**
 * Public review list (REST API v1, Android shop app).
 *
 * GET /api/v1/products/[slug]/reviews?page=1&perPage=20
 *
 * Reuses the product page's review query (lib/shop/queries):
 * approved reviews only, newest first, capped at 100 — the aggregate
 * {avg, count} is derived from the same array as the list (see
 * lib/shop/review-summary), so count/avg can never disagree with the
 * items on the page. `total` is the approved-review count (≤ 100, same
 * cap as the page). Items carry no email, no moderation fields.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ip = clientIp(req)
  if (await isRateLimited('api-v1-reviews-list', ip, LIST_MAX_PER_MIN, 60_000, { relaxUnknown: true })) {
    return fail('Забагато запитів, спробуйте пізніше', 429)
  }
  const parsed = parseListParams(req)
  if ('error' in parsed) return fail(parsed.error, 400)
  const { slug } = await params
  const found = await getProductBySlug(slug)
  if (!found) return fail('Товар не знайдено', 404)
  const productId = found.product.id

  const all = await getApprovedReviews(productId)
  const aggregate = summarizeReviews(all)
  const total = all.length
  const items = all
    .slice((parsed.page - 1) * parsed.perPage, parsed.page * parsed.perPage)
    .map((r) => ({
      authorName: r.authorName,
      rating: r.rating,
      text: r.body,
      createdAt: r.createdAt ? r.createdAt.toISOString() : null,
    }))
  return ok({ items, aggregate, total, page: parsed.page, perPage: parsed.perPage })
}

/**
 * Submit a review (REST API v1, Android shop app).
 *
 * POST /api/v1/products/[slug]/reviews
 * Body: { authorName, rating (int 1..5), text, orderNumber? }
 *
 * Validation is strict (400, not silent truncation — unlike the website
 * form, which slices overlong input): the app must show the user the
 * problem. The text is sanitized with the repo helper before storing;
 * review bodies render as plain text on the site. `orderNumber` is
 * optional — when supplied it must belong to an existing order (existence
 * only; no purchase linkage is required or checked). The insert itself is
 * delegated to submitReview (app/actions/shop): same caps, same
 * pending-moderation status, same per-IP backstop limiter as the website.
 * Returns the same result the website gets: { success: true }.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const ip = clientIp(req)
  // Strict ceiling, no relaxUnknown — a public write endpoint.
  if (await isRateLimited('api-v1-reviews-submit', ip, SUBMIT_MAX_PER_MIN)) {
    return fail('Забагато запитів, спробуйте пізніше', 429)
  }
  const { slug } = await params
  const found = await getProductBySlug(slug)
  if (!found) return fail('Товар не знайдено', 404)
  const productId = found.product.id

  const body = await readJson<Record<string, unknown>>(req)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Некорректний JSON', 400)
  }

  const authorName = typeof body.authorName === 'string' ? body.authorName.trim() : ''
  if (!authorName) return fail("Ім'я автора обовʼязкове", 400)
  if (authorName.length > MAX_NAME_LENGTH) return fail("Ім'я автора занадто довге", 400)

  const rating = body.rating
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return fail('Оцінка має бути цілим числом від 1 до 5', 400)
  }

  const rawText = typeof body.text === 'string' ? body.text : ''
  if (!rawText.trim()) return fail('Текст відгуку обовʼязковий', 400)
  if (rawText.length > MAX_TEXT_LENGTH) return fail('Текст відгуку занадто довгий', 400)
  const text = sanitizeContent(rawText).trim()
  if (!text) return fail('Текст відгуку обовʼязковий', 400)

  if (body.orderNumber != null && body.orderNumber !== '') {
    if (typeof body.orderNumber !== 'string') return fail('Некорректний номер замовлення', 400)
    const [order] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.orderNumber, body.orderNumber))
      .limit(1)
    if (!order) return fail('Замовлення не знайдено', 400)
  }

  const res = await submitReview({ productId, rating, body: text, authorName })
  if (!res.success) return fail(res.error ?? 'Не вдалося надіслати відгук', 400)
  return ok({ success: true })
}
