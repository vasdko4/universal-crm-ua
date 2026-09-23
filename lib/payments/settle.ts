import { db, pool } from '@/lib/db'
import { payments, paymentEvents, orders, orderHistory } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { finalizePaidOrder, restoreStockOnce } from '@/lib/shop/order-fulfillment'
import { extractGatewayReceiptUrl } from '@/lib/payments/receipt'
import { classifyWebhookRefund } from '@/lib/payments/refund'

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
  opts: {
    eventType?: string
    message?: string
    amount?: number
    refundedAmount?: number
    raw?: unknown
  } = {},
): Promise<{ ok: boolean; matchedPayment: boolean; matchedOrder: boolean }> {
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.orderReference, orderReference))
    .limit(1)

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.orderNumber, orderReference))
    .limit(1)

  // A late Approved after the merchant already refunded must not flip the
  // order back to paid or run fulfillment (WayForPay retries Service URL).
  const alreadyRefunded =
    payment?.status === 'refunded' ||
    payment?.status === 'partially_refunded' ||
    order?.paymentStatus === 'refunded'
  if (alreadyRefunded && status === 'paid') {
    if (payment) {
      await db
        .insert(paymentEvents)
        .values({
          paymentId: payment.id,
          type: opts.eventType ?? 'webhook',
          status: 'ignored_paid_after_refund',
          amount: opts.amount != null ? opts.amount.toFixed(2) : null,
          message: 'Поздний paid после возврата — заказ и платёж не тронуты',
          payload: (opts.raw as object) ?? null,
        })
        .catch(() => {})
    }
    return { ok: true, matchedPayment: Boolean(payment), matchedOrder: Boolean(order) }
  }

  // A signed/authoritative `paid` with a short amount must not mark the
  // payment or the order paid, and must not decrement stock (invoice
  // tampering, currency rounding, partial capture). Skip the check when
  // the gateway did not report an amount.
  if (status === 'paid' && order && opts.amount != null && Number.isFinite(opts.amount)) {
    const expected = Number(order.total)
    if (!(opts.amount + 0.01 >= expected)) {
      if (payment) {
        await db
          .insert(paymentEvents)
          .values({
            paymentId: payment.id,
            type: opts.eventType ?? 'webhook',
            status: 'amount_mismatch',
            amount: opts.amount.toFixed(2),
            message: `Сумма шлюза ${opts.amount.toFixed(2)} меньше итога заказа ${expected.toFixed(2)} — заказ не отмечен оплаченным`,
            payload: (opts.raw as object) ?? null,
          })
          .catch(() => {})
      }
      await db
        .insert(orderHistory)
        .values({
          orderId: order.id,
          type: 'payment',
          message: `Оплата отклонена: сумма шлюза ${opts.amount.toFixed(2)} < ${expected.toFixed(2)}`,
          actor: 'Платёжный шлюз',
        })
        .catch(() => {})
      return { ok: true, matchedPayment: Boolean(payment), matchedOrder: true }
    }
  }

  const incomingTerminal = status === 'paid' || status === 'refunded'
  const paymentTerminal =
    payment != null &&
    (payment.status === 'paid' ||
      payment.status === 'refunded' ||
      payment.status === 'partially_refunded')
  const orderTerminal =
    order != null && (order.paymentStatus === 'paid' || order.paymentStatus === 'refunded')
  // A late Pending / Declined / RefundInProcessing must not pull a paid or
  // refunded payment/order back to unpaid. Webhooks and admin refresh both
  // land here.
  if (!incomingTerminal && (paymentTerminal || orderTerminal)) {
    if (payment) {
      await db
        .insert(paymentEvents)
        .values({
          paymentId: payment.id,
          type: opts.eventType ?? 'webhook',
          status: `ignored_${status}`,
          amount: opts.amount != null ? opts.amount.toFixed(2) : null,
          message: `Пропущен нетерминальный статус «${status}» — платёж уже ${payment.status}`,
          payload: (opts.raw as object) ?? null,
        })
        .catch(() => {})
    }
    return { ok: true, matchedPayment: Boolean(payment), matchedOrder: Boolean(order) }
  }

  let matchedPayment = false
  if (payment) {
    matchedPayment = true
    // Do not downgrade a fully refunded payment back to paid/pending.
    // Partial refunds are covered by the non-terminal guard above; a later
    // `refunded` webhook is allowed through so the cabinet can complete it.
    const keepRefunded = payment.status === 'refunded' && status !== 'refunded'
    // If the gateway's status/webhook payload happens to include a real
    // fiscal receipt URL (only WayForPay/Monobank accounts with
    // fiscalization enabled do), capture it once so the order's receipt can
    // link to it instead of the non-fiscal fallback.
    const receiptUrl = payment.receiptUrl ?? extractGatewayReceiptUrl(payment.gatewayCode, opts.raw)
    // Incoming `refunded` is classified below (full vs partial). Do not stamp
    // the payment as fully refunded here or the partial UPDATE will miss it.
    const nextPaymentStatus = keepRefunded
      ? 'refunded'
      : status === 'refunded'
        ? payment.status
        : status
    await db
      .update(payments)
      .set({
        status: nextPaymentStatus,
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

  let matchedOrder = false
  if (order) {
    matchedOrder = true
    const refundKind =
      status === 'refunded'
        ? classifyWebhookRefund(Number(payment?.amount ?? order.total), opts.refundedAmount ?? opts.amount)
        : null
    const paymentStatus =
      status === 'paid'
        ? 'paid'
        : refundKind === 'partially_refunded'
          ? 'partially_refunded'
          : status === 'refunded'
            ? 'refunded'
            : 'unpaid'
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
            : refundKind === 'partially_refunded'
              ? 'Частичный возврат (онлайн-шлюз) — склад не восстановлен'
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
    // Declined / expired invoices should leave the admin list, not hang as
    // pending_payment forever (FIX-07).
    if ((status === 'failed' || status === 'expired') && order.status === 'pending_payment') {
      await pool.query(
        `UPDATE orders SET status = 'cancelled', updated_at = NOW()
          WHERE id = $1 AND status = 'pending_payment'`,
        [order.id],
      )
    }
    // A refund initiated in the gateway cabinet (or a chargeback) never
    // goes through refundPayment. Full refunds restore stock once; partial
    // ones only record the amount (FIX-05).
    if (status === 'refunded' && order.status !== 'cancelled') {
      if (payment) {
        if (refundKind === 'partially_refunded') {
          const reported = Number(opts.refundedAmount ?? opts.amount)
          await pool.query(
            `UPDATE payments
                SET refunded_amount = GREATEST(refunded_amount, $2),
                    status = 'partially_refunded',
                    updated_at = NOW()
              WHERE id = $1 AND status IN ('paid', 'partially_refunded')`,
            [payment.id, reported.toFixed(2)],
          )
        } else {
          await pool.query(
            `UPDATE payments
                SET refunded_amount = amount,
                    status = 'refunded',
                    updated_at = NOW()
              WHERE id = $1 AND refunded_amount < amount`,
            [payment.id],
          )
          await restoreStockOnce(order.id)
        }
      } else {
        await restoreStockOnce(order.id)
      }
    }
  }

  return { ok: matchedPayment || matchedOrder, matchedPayment, matchedOrder }
}
