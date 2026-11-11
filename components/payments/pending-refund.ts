import type { Payment } from '@/lib/db/schema'

/**
 * Whether a payment shows the 'refund pending' badge in the admin payments
 * list. A refund is pending while an amount is reserved in
 * payments.pending_refund_amount but the gateway has not confirmed it yet
 * (two-phase journal from 3.4.87: CAS reserve, then finalize after gateway
 * success). A fully refunded payment never shows the badge: finalize clears
 * the reserve, so a nonzero pending amount on a 'refunded' row would be
 * stale data, not a live reservation.
 */
export function hasPendingRefund(
  payment: Pick<Payment, 'status' | 'pendingRefundAmount'>,
): boolean {
  return Number(payment.pendingRefundAmount) > 0 && payment.status !== 'refunded'
}
