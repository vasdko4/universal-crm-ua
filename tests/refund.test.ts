import { describe, it, expect } from 'vitest'
import { refundPlan } from '@/lib/payments/refund'

describe('refundPlan', () => {
  it('full refund when amount omitted', () => {
    expect(refundPlan(1499.4, 0)).toEqual({
      ok: true,
      amount: 1499.4,
      newRefunded: 1499.4,
      status: 'refunded',
    })
  })

  it('partial refund stays partially_refunded', () => {
    expect(refundPlan(100, 0, 40)).toEqual({
      ok: true,
      amount: 40,
      newRefunded: 40,
      status: 'partially_refunded',
    })
  })

  it('second partial that closes the remainder is refunded', () => {
    expect(refundPlan(100, 40, 60)).toEqual({
      ok: true,
      amount: 60,
      newRefunded: 100,
      status: 'refunded',
    })
  })

  it('rejects over-refund and zero remaining', () => {
    expect(refundPlan(100, 0, 100.5)).toEqual({ ok: false, error: 'exceeds' })
    expect(refundPlan(100, 100)).toEqual({ ok: false, error: 'none' })
  })
})
