import { describe, it, expect } from 'vitest'
import { buildFunnel, perVisitor, ratePercent } from '@/lib/analytics/funnel'

describe('ratePercent', () => {
  it('returns null instead of Infinity/NaN when there is no denominator', () => {
    expect(ratePercent(5, 0)).toBeNull()
    expect(ratePercent(5, -1)).toBeNull()
    expect(ratePercent(Number.NaN, 10)).toBeNull()
  })

  it('never reports more than 100%', () => {
    // Adding to cart straight from a listing card (without opening the
    // product) can leave a stage larger than the one before it.
    expect(ratePercent(1176, 151)).toBe(100)
    expect(ratePercent(30, 120)).toBe(25)
  })
})

describe('perVisitor', () => {
  it('reports browsing depth as a ratio, not a percentage', () => {
    // The old dashboard rendered this very number as "778.8% conversion".
    expect(perVisitor(1176, 151)).toBeCloseTo(7.788, 3)
    expect(perVisitor(10, 0)).toBe(0)
  })
})

describe('buildFunnel', () => {
  const funnel = buildFunnel({
    visitors: 151,
    productViewers: 120,
    cartSessions: 30,
    orders: 12,
    paidOrders: 9,
    fulfilledOrders: 6,
    productViews: 1176,
  })

  it('uses the previous stage as the denominator of each step', () => {
    const byKey = Object.fromEntries(funnel.stages.map((s) => [s.key, s]))
    expect(byKey.visitors.conversionFromPrev).toBeNull()
    expect(byKey.productViewers.conversionFromPrev).toBeCloseTo((120 / 151) * 100, 6)
    expect(byKey.carts.conversionFromPrev).toBeCloseTo((30 / 120) * 100, 6)
    expect(byKey.orders.conversionFromPrev).toBeCloseTo((12 / 30) * 100, 6)
    expect(byKey.paidOrders.conversionFromPrev).toBeCloseTo((9 / 12) * 100, 6)
    expect(byKey.fulfilledOrders.conversionFromPrev).toBeCloseTo((6 / 9) * 100, 6)
  })

  it('keeps browsing depth separate from conversion', () => {
    expect(funnel.productViewsPerVisitor).toBeCloseTo(7.788, 3)
    // visitor -> paid order, not orders/pageviews
    expect(funnel.overallConversion).toBeCloseTo((9 / 151) * 100, 6)
  })

  it('reports drop-off between stages', () => {
    const byKey = Object.fromEntries(funnel.stages.map((s) => [s.key, s]))
    expect(byKey.productViewers.dropOff).toBe(31)
    expect(byKey.orders.dropOff).toBe(18)
  })

  it('degrades gracefully on an empty period', () => {
    const empty = buildFunnel({
      visitors: 0,
      productViewers: 0,
      cartSessions: 0,
      orders: 0,
      paidOrders: 0,
      fulfilledOrders: 0,
      productViews: 0,
    })
    expect(empty.overallConversion).toBeNull()
    expect(empty.productViewsPerVisitor).toBe(0)
    expect(empty.stages.every((s) => s.value === 0)).toBe(true)
  })
})
