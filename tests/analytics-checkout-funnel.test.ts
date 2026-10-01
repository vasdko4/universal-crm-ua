import { describe, it, expect } from 'vitest'
import { buildCheckoutFunnel } from '@/lib/analytics/funnel'

describe('buildCheckoutFunnel', () => {
  const stages = buildCheckoutFunnel({
    cartSessions: 100,
    checkoutSessions: 60,
    orders: 30,
    paidOrders: 24,
    fulfilledOrders: 20,
  })
  const byKey = Object.fromEntries(stages.map((s) => [s.key, s]))

  it('orders the measurable checkout steps', () => {
    expect(stages.map((s) => s.key)).toEqual(['carts', 'checkoutVisits', 'orders', 'paidOrders', 'fulfilledOrders'])
  })

  it('uses the previous stage as the denominator of each step', () => {
    expect(byKey.carts.conversionFromPrev).toBeNull()
    expect(byKey.checkoutVisits.conversionFromPrev).toBeCloseTo(60, 6)
    expect(byKey.orders.conversionFromPrev).toBeCloseTo(50, 6)
    expect(byKey.paidOrders.conversionFromPrev).toBeCloseTo(80, 6)
    expect(byKey.fulfilledOrders.conversionFromPrev).toBeCloseTo((20 / 24) * 100, 6)
  })

  it('reports drop-off between stages', () => {
    expect(byKey.checkoutVisits.dropOff).toBe(40)
    expect(byKey.orders.dropOff).toBe(30)
    expect(byKey.fulfilledOrders.dropOff).toBe(4)
  })

  it('clamps to 100% when a later stage outgrows the previous one', () => {
    // A buyer can open checkout without an add_to_cart event in the window.
    const f = buildCheckoutFunnel({ cartSessions: 10, checkoutSessions: 40, orders: 5, paidOrders: 5, fulfilledOrders: 5 })
    const b = Object.fromEntries(f.map((s) => [s.key, s]))
    expect(b.checkoutVisits.conversionFromPrev).toBe(100)
    expect(b.checkoutVisits.dropOff).toBe(0)
  })

  it('degrades gracefully on an empty period', () => {
    const f = buildCheckoutFunnel({ cartSessions: 0, checkoutSessions: 0, orders: 0, paidOrders: 0, fulfilledOrders: 0 })
    const b = Object.fromEntries(f.map((s) => [s.key, s]))
    expect(b.checkoutVisits.conversionFromPrev).toBeNull()
    expect(b.orders.conversionFromPrev).toBeNull()
    expect(f.every((s) => s.value === 0)).toBe(true)
  })
})
