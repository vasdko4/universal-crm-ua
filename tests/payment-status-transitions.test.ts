import { describe, it, expect } from 'vitest'
import { isPaymentStatusTransitionAllowed } from '@/lib/order-status'

describe('payment-status transitions (admin updateOrderPayment)', () => {
  it('allows money to move forward only', () => {
    expect(isPaymentStatusTransitionAllowed('unpaid', 'paid')).toBe(true)
    expect(isPaymentStatusTransitionAllowed('paid', 'partially_refunded')).toBe(true)
    expect(isPaymentStatusTransitionAllowed('paid', 'refunded')).toBe(true)
    expect(isPaymentStatusTransitionAllowed('partially_refunded', 'refunded')).toBe(true)
  })

  it('rejects paid -> unpaid: stock stays deducted and promo counted', () => {
    expect(isPaymentStatusTransitionAllowed('paid', 'unpaid')).toBe(false)
  })

  it('rejects refunds of money that was never paid', () => {
    expect(isPaymentStatusTransitionAllowed('unpaid', 'refunded')).toBe(false)
    expect(isPaymentStatusTransitionAllowed('unpaid', 'partially_refunded')).toBe(false)
  })

  it('rejects going back from a refund, and anything out of refunded (terminal)', () => {
    expect(isPaymentStatusTransitionAllowed('partially_refunded', 'paid')).toBe(false)
    expect(isPaymentStatusTransitionAllowed('partially_refunded', 'unpaid')).toBe(false)
    expect(isPaymentStatusTransitionAllowed('refunded', 'paid')).toBe(false)
    expect(isPaymentStatusTransitionAllowed('refunded', 'unpaid')).toBe(false)
    expect(isPaymentStatusTransitionAllowed('refunded', 'partially_refunded')).toBe(false)
  })

  it('allows re-saving the same status (repairs paid-but-pending_payment)', () => {
    for (const s of ['unpaid', 'paid', 'partially_refunded', 'refunded']) {
      expect(isPaymentStatusTransitionAllowed(s, s)).toBe(true)
    }
  })

  it('rejects unknown statuses', () => {
    expect(isPaymentStatusTransitionAllowed('pending', 'paid')).toBe(false)
    expect(isPaymentStatusTransitionAllowed('paid', 'pending')).toBe(false)
  })
})
