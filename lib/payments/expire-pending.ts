import { db, pool } from '@/lib/db'
import { paymentGateways, payments } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { monobankCheckStatus, wayforpayCheckStatus } from '@/lib/payments/clients'
import { settlePayment } from '@/lib/payments/settle'

const DEFAULT_MAX_AGE_MINUTES = 45
const DEFAULT_LIMIT = 25

/**
 * Re-probes gateways for stale `pending_payment` orders, then cancels anything
 * still unpaid (FIX-07). Paid / refunded answers go through settlePayment.
 * A failed probe does not cancel — the shopper may have paid while the API was down.
 */
export async function expirePendingPayments(opts?: {
  maxAgeMinutes?: number
  limit?: number
}): Promise<{ probed: number; settled: number; cancelled: number }> {
  const maxAgeMinutes = opts?.maxAgeMinutes ?? DEFAULT_MAX_AGE_MINUTES
  const limit = opts?.limit ?? DEFAULT_LIMIT

  const { rows } = await pool.query<{
    id: number
    order_number: string
    gateway_code: string | null
    invoice_id: string | null
  }>(
    `SELECT o.id, o.order_number, p.gateway_code, p.invoice_id
       FROM orders o
       LEFT JOIN payments p ON p.order_reference = o.order_number
      WHERE o.status = 'pending_payment'
        AND o.created_at < NOW() - ($1::text || ' minutes')::interval
      ORDER BY o.created_at ASC
      LIMIT $2`,
    [String(maxAgeMinutes), limit],
  )

  let settled = 0
  let cancelled = 0

  for (const row of rows) {
    let canCancel = !row.gateway_code
    if (row.gateway_code === 'wayforpay' || (row.gateway_code === 'monobank' && row.invoice_id)) {
      const [gateway] = await db
        .select()
        .from(paymentGateways)
        .where(eq(paymentGateways.code, row.gateway_code))
        .limit(1)
      const cfg = (gateway?.config ?? {}) as Record<string, string>
      const result =
        row.gateway_code === 'wayforpay'
          ? await wayforpayCheckStatus(cfg, row.order_number)
          : await monobankCheckStatus(cfg, row.invoice_id as string)
      if (!result.ok || !result.status) continue
      if (result.status === 'paid' || result.status === 'refunded') {
        await settlePayment(row.order_number, result.status, {
          eventType: 'expire-cron',
          amount: result.amount,
          refundedAmount: result.refundedAmount,
          message: result.message,
          raw: result.raw,
        })
        settled += 1
        canCancel = false
      } else {
        await settlePayment(row.order_number, result.status, {
          eventType: 'expire-cron',
          amount: result.amount,
          message: result.message,
          raw: result.raw,
        })
        settled += 1
        canCancel = true
      }
    }

    if (!canCancel) continue

    const claim = await pool.query(
      `UPDATE orders
          SET status = 'cancelled',
              payment_status = 'unpaid',
              updated_at = NOW()
        WHERE id = $1 AND status = 'pending_payment'
        RETURNING id`,
      [row.id],
    )
    if (claim.rowCount) {
      cancelled += 1
      await pool.query(
        `INSERT INTO order_history (order_id, type, message, actor)
         VALUES ($1, 'status', 'Неоплаченный заказ автоматически отменён', 'System')`,
        [row.id],
      )
      if (row.gateway_code) {
        await db
          .update(payments)
          .set({ status: 'expired', updatedAt: new Date() })
          .where(eq(payments.orderReference, row.order_number))
          .catch(() => {})
      }
    }
  }

  return { probed: rows.length, settled, cancelled }
}
