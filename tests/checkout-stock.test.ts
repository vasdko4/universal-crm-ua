import { describe, it, expect } from 'vitest'
import { applyStockLine, checkoutStockError } from '@/lib/shop/checkout-stock'

describe('applyStockLine', () => {
  it('decrements when stock is enough', () => {
    expect(applyStockLine({ onHand: 5, requested: 2, name: 'Phone' })).toEqual({
      nextOnHand: 3,
      fulfilled: 2,
      oversold: false,
    })
  })

  it('never goes negative and flags oversold', () => {
    expect(applyStockLine({ onHand: 1, requested: 3, name: 'Phone' })).toEqual({
      nextOnHand: 0,
      fulfilled: 1,
      oversold: true,
    })
  })
})

describe('checkoutStockError', () => {
  it('rejects when requested exceeds on-hand', () => {
    expect(checkoutStockError({ onHand: 0, requested: 1, name: 'Case', variantLabel: 'Black' })).toBe(
      'Case (Black)',
    )
    expect(checkoutStockError({ onHand: 2, requested: 1, name: 'Case' })).toBeNull()
  })
})
