import { desc, eq } from 'drizzle-orm'
import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { orders, payments } from '@/lib/db/schema'
import { fail, ok } from '@/lib/api/helpers'
import { clientIp, isRateLimited } from '@/lib/api/rate-limit'
import { normalizeUaPhone } from '@/lib/shop/phone'

const MAX_PER_MIN = 30
const NOT_FOUND = 'Замовлення не знайдено'

/**
 * Public payment-status check (REST API v1, Android shop app) — the app
 * calls this after a WayForPay/Monobank redirect to learn whether the
 * payment went through.
 *
 * GET /api/v1/orders/[number]/payment?phone=+380XXXXXXXXX
 *
 * Same phone proof as the order lookup: every failure mode — missing/invalid
 * phone, unknown number, phone mismatch — returns the same 404, so the
 * endpoint cannot probe whether an order number exists. Response carries
 * only {orderNumber, paid, paymentStatus} — no gateway data, no amounts,
 * no email.
 *
 * NOTE: checkOrderPaymentStatus (app/actions/shop) is NOT reused here — it
 * gates access on the shopper session / last-order cookie, which a stateless
 * phone-verified API caller never has, so it would always answer "not
 * found" (same reason the order lookup does not reuse getOrderByNumber).
 * The stored payment row is the right source: webhooks settle payments
 * through settlePayment (the single source of truth), so the status the app
 * reads is the authoritative one. A live gateway re-query would need
 * checkOrderPaymentStatus to accept an explicit (phone-verified)
 * authorization — a change to shared code, left for a later slice.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ number: string }> }) {
  const ip = clientIp(req)
  if (await isRateLimited('api-v1-order-payment', ip, MAX_PER_MIN, 60_000, { relaxUnknown: true })) {
    return fail('Забагато запитів, спробуйте пізніше', 429)
  }
  const { number } = await params
  const phone = normalizeUaPhone(new URL(req.url).searchParams.get('phone') ?? '')
  if (!phone) return fail(NOT_FOUND, 404)

  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, number)).limit(1)
  if (!order) return fail(NOT_FOUND, 404)
  const orderPhone = order.customerPhone ? normalizeUaPhone(order.customerPhone) : null
  if (!orderPhone || orderPhone !== phone) return fail(NOT_FOUND, 404)

  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.orderReference, number))
    .orderBy(desc(payments.createdAt))
    .limit(1)

  // No payment row (e.g. cash on delivery): the order's own paymentStatus
  // ('unpaid' by default) is the answer.
  const paymentStatus = payment?.status ?? order.paymentStatus
  return ok({
    orderNumber: order.orderNumber,
    paid: paymentStatus === 'paid',
    paymentStatus,
  })
}
