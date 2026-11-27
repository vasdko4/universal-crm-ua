import { asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { orderItems, orders } from '@/lib/db/schema'
import { normalizeUaPhone } from '@/lib/shop/phone'

/**
 * Public order-status lookup shared by the API v1 order-lookup endpoints
 * (3.4.107 fix 4).
 *
 * The caller must prove they know the order's phone number: the supplied
 * phone is normalized (lib/shop/phone) and compared with the phone stored on
 * the order. Every failure mode — missing/invalid phone, unknown number,
 * phone mismatch — returns `null`, so callers can answer with the same 404
 * and the endpoint cannot be used to probe whether an order number exists.
 * The payload carries only what a customer needs to track their order: no
 * email, no stored phone, no internal notes, no gateway data. Statuses are
 * NOT filtered (a pending_payment order is a legitimate thing to look up —
 * the customer is checking whether the payment went through).
 *
 * NOTE: getOrderByNumber (app/actions/shop) is NOT reused here — it gates
 * access on the shopper session / last-order cookie, which a stateless API
 * caller never has, so it would always return null.
 */
export interface OrderLookupData {
  orderNumber: string
  status: string
  paymentStatus: string
  paymentMethod: string | null
  items: { name: string; quantity: number; price: number }[]
  totals: { itemsTotal: number; deliveryCost: number; discountTotal: number; total: number }
  delivery: {
    method: string | null
    city: string | null
    branch: string | null
    address: string | null
    trackingNumber: string | null
  }
  createdAt: string | null
}

export async function lookupOrderByNumberAndPhone(
  number: string,
  rawPhone: string,
): Promise<OrderLookupData | null> {
  // Empty number can never match a real order (order numbers are 12-digit
  // crypto-random strings); reject it here so a missing `number` field in
  // the POST body is a 404 like every other bad input.
  if (!number) return null
  const phone = normalizeUaPhone(rawPhone)
  if (!phone) return null

  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, number)).limit(1)
  if (!order) return null
  const orderPhone = order.customerPhone ? normalizeUaPhone(order.customerPhone) : null
  if (!orderPhone || orderPhone !== phone) return null

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id))
    .orderBy(asc(orderItems.id))

  return {
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
  }
}
