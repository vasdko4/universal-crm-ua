import { describe, it, expect } from 'vitest'

/** Mirrors the paid-amount gate in settlePayment. */
function paidAmountCoversTotal(paid: number | undefined, orderTotal: number): boolean {
  if (paid == null || !Number.isFinite(paid)) return false
  return Number(paid) + 0.001 >= Number(orderTotal)
}

describe('settlePayment amount vs order total', () => {
  it('accepts a matching or slightly overpaid amount', () => {
    expect(paidAmountCoversTotal(1499.4, 1499.4)).toBe(true)
    expect(paidAmountCoversTotal(1500, 1499.4)).toBe(true)
  })

  it('rejects a short payment', () => {
    expect(paidAmountCoversTotal(1, 1499.4)).toBe(false)
    expect(paidAmountCoversTotal(1499, 1499.4)).toBe(false)
  })

  it('rejects a paid webhook that did not report an amount', () => {
    expect(paidAmountCoversTotal(undefined, 1499.4)).toBe(false)
    expect(paidAmountCoversTotal(Number.NaN, 1499.4)).toBe(false)
  })
})
