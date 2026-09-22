/**
 * Sales funnel math.
 *
 * The dashboard used to divide every step by the *first* step (or by whatever
 * step came before it, regardless of unit), which produced nonsense like
 * "1176 product views / 151 visitors = 778.8% conversion". Two different
 * mistakes were mixed together:
 *
 *   1. raw event counts (product views) were compared to unique sessions
 *      (visitors) — that ratio is a *depth* metric ("views per visitor"),
 *      never a conversion rate;
 *   2. later steps reused the wrong denominator, so "cart → order" was not
 *      actually measured against carts.
 *
 * Here every stage is counted in a comparable unit (unique sessions for
 * traffic stages, orders for order stages) and each conversion uses the
 * immediately preceding stage as its denominator:
 *
 *   visitor → product view → cart → order → paid → shipped/picked up
 */

export type FunnelStageKey =
  | 'visitors'
  | 'productViewers'
  | 'carts'
  | 'orders'
  | 'paidOrders'
  | 'fulfilledOrders'

export type FunnelInput = {
  /** Unique sessions with at least one pageview. */
  visitors: number
  /** Unique sessions that opened at least one product. */
  productViewers: number
  /** Unique sessions that added at least one product to the cart. */
  cartSessions: number
  /** Orders placed in the period (cancelled excluded). */
  orders: number
  /** Orders whose payment is settled. */
  paidOrders: number
  /** Paid orders that were shipped or completed. */
  fulfilledOrders: number
  /** Raw product_view events — used for the depth metric, not for a rate. */
  productViews: number
}

export type FunnelStage = {
  key: FunnelStageKey
  value: number
  /** Percentage of the previous stage. null for the first stage or no data. */
  conversionFromPrev: number | null
  /** Percentage of the first stage. null for the first stage or no data. */
  shareOfVisitors: number | null
  /** How many units were lost between the previous stage and this one. */
  dropOff: number | null
}

export type SalesFunnel = {
  stages: FunnelStage[]
  /**
   * Product views per visitor (e.g. 7.8). A browsing-depth ratio — this is
   * the number that used to be mislabelled as a 778.8% conversion.
   */
  productViewsPerVisitor: number
  /** visitor → paid order, the only number that deserves "overall conversion". */
  overallConversion: number | null
}

/**
 * Percentage of `numerator` in `denominator`.
 *
 * Returns null when there is nothing to divide by (no data yet) instead of
 * Infinity/NaN. The result is clamped to 100%: a shopper can add to cart
 * straight from a listing card without ever opening a product page, so a
 * later stage can legitimately hold more sessions than the one before it —
 * that is a data-collection quirk, not a >100% conversion.
 */
export function ratePercent(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null
  if (denominator <= 0) return null
  return Math.min(100, Math.max(0, (numerator / denominator) * 100))
}

/** Average number of events per unique visitor (a ratio, not a percentage). */
export function perVisitor(events: number, visitors: number): number {
  if (!Number.isFinite(events) || !Number.isFinite(visitors) || visitors <= 0) return 0
  return events / visitors
}

export function buildFunnel(input: FunnelInput): SalesFunnel {
  const ordered: { key: FunnelStageKey; value: number }[] = [
    { key: 'visitors', value: Math.max(0, input.visitors) },
    { key: 'productViewers', value: Math.max(0, input.productViewers) },
    { key: 'carts', value: Math.max(0, input.cartSessions) },
    { key: 'orders', value: Math.max(0, input.orders) },
    { key: 'paidOrders', value: Math.max(0, input.paidOrders) },
    { key: 'fulfilledOrders', value: Math.max(0, input.fulfilledOrders) },
  ]
  const first = ordered[0].value

  const stages: FunnelStage[] = ordered.map((stage, i) => {
    if (i === 0) {
      return { ...stage, conversionFromPrev: null, shareOfVisitors: null, dropOff: null }
    }
    const prev = ordered[i - 1].value
    return {
      ...stage,
      conversionFromPrev: ratePercent(stage.value, prev),
      shareOfVisitors: ratePercent(stage.value, first),
      dropOff: prev > stage.value ? prev - stage.value : 0,
    }
  })

  return {
    stages,
    productViewsPerVisitor: perVisitor(input.productViews, input.visitors),
    overallConversion: ratePercent(Math.max(0, input.paidOrders), first),
  }
}
