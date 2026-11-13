import { asc, eq } from 'drizzle-orm'
import { type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { orderItems, orders } from '@/lib/db/schema'
import { fail, ok } from '@/lib/api/helpers'
import { clientIp, isRateLimited } from '@/lib/api/rate-limit'
import { normalizeUaPhone } from '@/lib/shop/phone'

const MAX_PER_MIN = 30
const NOT_FOUND = 'Замовлення не знайдено'

/**
 * Public order-status lookup (REST API v1, Android shop app).
 *
 * GET /api/v1/orders/[number]?phone=+380XXXXXXXXX
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
  const phone = normalizeUaPhone(new URL(req.url).searchParams.get('phone') ?? '')
  if (!phone) return fail(NOT_FOUND, 404)

  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, number)).limit(1)
  if (!order) return fail(NOT_FOUND, 404)
  const orderPhone = order.customerPhone ? normalizeUaPhone(order.customerPhone) : null
  if (!orderPhone || orderPhone !== phone) return fail(NOT_FOUND, 404)

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id))
    .orderBy(asc(orderItems.id))

  return ok({
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    items: items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: Number(item.price),
    })),
    totals: {
      itemsTotal: Number(order.itemsTotal),
      deliveryCost: Number(order.deliveryCost),
      discountTotal: Number(order.discountTotal),
      total: Number(order.total),
    },
    delivery: {
      method: order.deliveryMethod,
      city: order.deliveryCity,
      branch: order.deliveryBranch,
      address: order.deliveryAddress,
      trackingNumber: order.trackingNumber,
    },
    createdAt: order.createdAt ? order.createdAt.toISOString() : null,
  })
}
