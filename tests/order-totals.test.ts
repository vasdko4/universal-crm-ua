import { describe, expect, it } from 'vitest'
import { computeOrderTotals } from '@/lib/shop/order-totals'

describe('computeOrderTotals', () => {
  it('matches the storefront formula when delivery is omitted', () => {
    expect(computeOrderTotals({ itemsTotal: 1000, discount: 150 })).toEqual({
      itemsTotal: 1000,
      deliveryCost: 0,
      discount: 150,
      total: 850,
    })
  })

  it('adds delivery the same way the admin builder does', () => {
    expect(computeOrderTotals({ itemsTotal: 500, deliveryCost: 80 })).toEqual({
      itemsTotal: 500,
      deliveryCost: 80,
      discount: 0,
      total: 580,
    })
  })

  it('never lets discount exceed the items subtotal', () => {
    expect(computeOrderTotals({ itemsTotal: 100, discount: 250, deliveryCost: 40 }).total).toBe(40)
  })
})
