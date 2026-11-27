import { fail, ok, readJson } from '@/lib/api/helpers'
import { lookupOrderByNumberAndPhone } from '@/lib/api/order-lookup'
import { clientIp, isRateLimited } from '@/lib/api/rate-limit'

const MAX_PER_MIN = 30
const NOT_FOUND = 'Замовлення не знайдено'

/**
 * Public order-status lookup (REST API v1, Android shop app).
 *
 * POST /api/v1/orders/lookup
 * Body: { number, phone }
 *
 * Same lookup as the deprecated GET /api/v1/orders/[number]?phone=, but the
 * phone travels in the request body instead of the URL query string, so it
 * no longer leaks into access logs (3.4.107 fix 4). Same 30/min per-IP
 * limit, shared with the GET endpoint (scope 'api-v1-order-lookup'), and
 * the same 404-on-any-failure contract: missing/invalid phone, unknown
 * number, phone mismatch, missing/non-string fields, malformed or
 * oversized JSON — every failure mode returns the identical 404
 * `{ success: false, error: "Замовлення не знайдено" }`, so the endpoint
 * cannot be used to probe whether an order number exists (and no 400
 * reveals which field was wrong). The response carries only what a
 * customer needs to track their order: no email, no stored phone, no
 * internal notes, no gateway data. Statuses are NOT filtered (a
 * pending_payment order is a legitimate thing to look up — the customer
 * is checking whether the payment went through).
 */
export async function POST(req: Request) {
  const ip = clientIp(req)
  if (await isRateLimited('api-v1-order-lookup', ip, MAX_PER_MIN, 60_000, { relaxUnknown: true })) {
    return fail('Забагато запитів, спробуйте пізніше', 429)
  }
  const body = await readJson<Record<string, unknown>>(req)
  const number = typeof body?.number === 'string' ? body.number : ''
  const phone = typeof body?.phone === 'string' ? body.phone : ''
  const data = await lookupOrderByNumberAndPhone(number, phone)
  if (!data) return fail(NOT_FOUND, 404)
  return ok(data)
}
