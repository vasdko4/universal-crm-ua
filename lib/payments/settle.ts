import { db, pool } from '@/lib/db'
import { payments, paymentEvents, orders, orderHistory } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { finalizePaidOrder } from '@/lib/shop/order-fulfillment'
import { extractGatewayReceiptUrl } from '@/lib/payments/receipt'

/**
 * Applies a verified gateway status update to the payment record and the linked
 * storefront order (matched by orderReference === orders.orderNumber).
 *
 * This is the single source of truth used by both webhook routes so the order's
 * paymentStatus stays in sync with the gateway. Safe to call repeatedly
 * (idempotent for the "paid" terminal state).
 */
export async function settlePayment(
  orderReference: string,
  status: string,
  opts: { eventType?: string; message?: string; amount?: number; raw?: unknown } = {},
): Promise<{ ok: boolean; matchedPayment: boolean; matchedOrder: boolean }> {
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.orderReference, orderReference))
    .limit(1)

  let matchedPayment = false
  if (payment) {
    matchedPayment = true
    // Do not downgrade a refunded payment back to paid/pending on late callbacks.
    const keepRefunded = payment.status === 'refunded' && status !== 'refunded'
    // If the gateway's status/webhook payload happens to include a real
    // fiscal receipt URL (only WayForPay/Monobank accounts with
    // fiscalization enabled do), capture it once so the order's receipt can
    // link to it instead of the non-fiscal fallback.
    const receiptUrl = payment.receiptUrl ?? extractGatewayReceiptUrl(payment.gatewayCode, opts.raw)
    await db
      .update(payments)
      .set({
        status: keepRefunded ? 'refunded' : status,
        receiptUrl: receiptUrl ?? payment.receiptUrl,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, payment.id))
    await db.insert(paymentEvents).values({
      paymentId: payment.id,
      type: opts.eventType ?? 'webhook',
      status,
      amount: opts.amount != null ? opts.amount.toFixed(2) : null,
      message: opts.message ?? `Колбэк шлюза: ${status}`,
      payload: (opts.raw as object) ?? null,
    })
  }

  // Sync the storefront order (orderReference mirrors orderNumber for shop orders).
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.orderNumber, orderReference))
    .limit(1)

  let matchedOrder = false
  if (order) {
    matchedOrder = true
    const paymentStatus = status === 'paid' ? 'paid' : status === 'refunded' ? 'refunded' : 'unpaid'
    if (order.paymentStatus !== paymentStatus) {
      await db
        .update(orders)
        .set({ paymentStatus, updatedAt: new Date() })
        .where(eq(orders.id, order.id))
      await db.insert(orderHistory).values({
        orderId: order.id,
        type: 'payment',
        message:
          status === 'paid'
            ? 'Оплата получена (онлайн-шлюз)'
            : status === 'refunded'
              ? 'Средства возвращены (онлайн-шлюз)'
              : `Статус оплаты обновлён: ${status}`,
        actor: 'Платёжный шлюз',
      })
    }
    // On confirmed payment, promote a pending online order to a real order
    // (decrement stock, record promo usage, analytics). Idempotent.
    if (status === 'paid') {
      await finalizePaidOrder(orderReference)
    }
  }

  return { ok: matchedPayment || matchedOrder, matchedPayment, matchedOrder }
}
