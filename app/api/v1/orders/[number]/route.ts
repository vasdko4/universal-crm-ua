import { type NextRequest } from 'next/server'
import { fail, ok } from '@/lib/api/helpers'
import { lookupOrderByNumberAndPhone } from '@/lib/api/order-lookup'
import { clientIp, isRateLimited } from '@/lib/api/rate-limit'

const MAX_PER_MIN = 30
const NOT_FOUND = 'Замовлення не знайдено'

/**
 * Public order-status lookup (REST API v1, Android shop app).
 *
 * GET /api/v1/orders/[number]?phone=+380XXXXXXXXX
 *
 * @deprecated The phone travels in the URL query string, so it leaks into
 * access logs. Use POST /api/v1/orders/lookup with { number, phone } in the
 * body instead (same response, same 30/min limit). Kept for the Android
 * app v4, which still calls this endpoint.
 *
 * The caller must prove they know the order's phone number: the supplied
 * phone is normalized (lib/shop/phone) and compared with the phone stored on
 * the order. Every failure mode — missing/invalid phone, unknown number,
 * phone mismatch — returns the same 404, so the endpoint cannot be used to
 * probe whether an order number exists. The response carries only what a
 * customer needs to track their order: no email, no internal notes, no
 * gateway data. Statuses are NOT filtered (a pending_payment order is a
 * legitimate thing to look up — the customer is checking whether the
 * payment went through).
 *
 * NOTE: getOrderByNumber (app/actions/shop) is NOT reused here — it gates
 * access on the shopper session / last-order cookie, which a stateless API
 * caller never has, so it would always return null.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ number: string }> }) {
  const ip = clientIp(req)
  if (await isRateLimited('api-v1-order-lookup', ip, MAX_PER_MIN, 60_000, { relaxUnknown: true })) {
    return fail('Забагато запитів, спробуйте пізніше', 429)
  }
  const { number } = await params
  const phone = new URL(req.url).searchParams.get('phone') ?? ''
  const data = await lookupOrderByNumberAndPhone(number, phone)
  if (!data) return fail(NOT_FOUND, 404)
  return ok(data)
}
