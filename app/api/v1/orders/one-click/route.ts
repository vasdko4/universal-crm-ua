import { createOneClickOrder } from '@/app/actions/shop'
import { fail, ok, readJson } from '@/lib/api/helpers'
import { clientIp, isRateLimited } from '@/lib/api/rate-limit'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { toUuid } from '@/lib/shop/one-click'

/** Positive integer that never lets NaN/Infinity/floats through. */
function toPositiveInt(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isInteger(v)) return null
  return v >= 1 && v <= 2_147_483_647 ? v : null
}

/**
 * Public one-click ("Купити в 1 клік") order for the store REST API v1
 * (Android shop app).
 *
 * POST /api/v1/orders/one-click
 * Body: { productId, variantId?, quantity?, name, phone, idempotencyKey? }
 * - productId: positive int, required. variantId: positive int, optional.
 * - quantity: one-click is a single-unit flow by design (OneClickLine
 *   quantity is always 1) — accepted only as 1 when present, anything else
 *   is a 400. There is no multi-unit one-click in the storefront either.
 * - name/phone: validated by createOneClickOrder (same rules as the website
 *   modal — name capped, phone via the checkout's UA normalization).
 * - idempotencyKey: client-generated UUID (one per modal open); a retried
 *   submit returns the already-created order instead of a duplicate.
 *
 * The price is recomputed from the DB rows inside createOneClickOrder — the
 * client never sends a price or a total. The action also has its own
 * per-IP limiter (5/min + 30/hourly, scopes 'one-click'/'one-click-hourly');
 * the route adds 10/min on top, and a rate-limit error from the action is
 * surfaced as 429 rather than 400.
 */
export async function POST(request: Request) {
  if (await isRateLimited('api-v1-one-click', clientIp(request), 10)) {
    return fail('Забагато запитів, спробуйте пізніше', 429)
  }
  const body = await readJson<Record<string, unknown>>(request)
  if (!body || typeof body !== 'object') return fail('Некорректный JSON', 400)

  const productId = toPositiveInt(body.productId)
  if (productId == null) return fail('Некорректный productId', 400)

  let variantId: number | undefined
  if (body.variantId != null) {
    const parsed = toPositiveInt(body.variantId)
    if (parsed == null) return fail('Некорректный variantId', 400)
    variantId = parsed
  }

  if (body.quantity != null) {
    const quantity = toPositiveInt(body.quantity)
    if (quantity !== 1) return fail('Швидке замовлення — завжди 1 товар', 400)
  }

  let idempotencyKey: string | undefined
  if (body.idempotencyKey != null) {
    const parsed = toUuid(body.idempotencyKey)
    if (parsed == null) return fail('Некорректный idempotencyKey', 400)
    idempotencyKey = parsed
  }

  const name = typeof body.name === 'string' ? body.name : ''
  const phone = typeof body.phone === 'string' ? body.phone : ''

  const res = await createOneClickOrder({ productId, variantId, name, phone, idempotencyKey })
  if (!res.success) {
    const rateLimitRu = getDictionary('ru').serverErrors.rateLimitOrders
    const rateLimitUk = getDictionary('uk').serverErrors.rateLimitOrders
    const isRateLimit = res.error === rateLimitRu || res.error === rateLimitUk
    return fail(res.error, isRateLimit ? 429 : 400)
  }
  return ok({
    orderId: res.orderId,
    orderNumber: res.orderNumber,
    total: res.total,
    itemsTotal: res.itemsTotal,
  })
}
