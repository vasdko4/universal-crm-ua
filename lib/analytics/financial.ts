/**
 * Shared "real sale" predicate + net-amount expressions for every financial
 * report in app/actions/analytics.ts (audit P1, 3.4.96: refunded money
 * stayed in revenue, profit and sales).
 *
 * Refund state lives on orders.payment_status — orders.status has NO
 * 'refunded' value (see ORDER_STATUSES in lib/order-status.ts) — so a
 * report that filters only on status counts a fully-refunded order at full
 * value. Every money or order-count query must use financialOrdersWhere()
 * instead of the bare status exclusion, and must sum netOrderTotal()
 * instead of the raw order total, so partially-refunded orders count at
 * net value.
 *
 * The payments join is 1:1 — payments.order_reference is UNIQUE and equals
 * orders.order_number (see the checkout insert in app/actions/shop.ts and
 * the same join in lib/payments/expire-pending.ts) — so the LEFT JOIN
 * never fans rows out: COUNT(*) stays exact and SUM(p.refunded_amount)
 * counts each order's refund exactly once.
 *
 * Item-level aggregates (units sold, per-item revenue/profit) use the
 * predicate but cannot be netted: per-line refund amounts are not tracked
 * anywhere, so a partial refund cannot be allocated to lines. The
 * order-level figures are the authoritative money numbers.
 */
export function financialOrdersWhere(orderAlias: string): string {
  return `${orderAlias}.status NOT IN ('cancelled', 'pending_payment') AND ${orderAlias}.payment_status <> 'refunded'`
}

/** The LEFT JOIN that makes netOrderTotal() available. */
export function financialPaymentsJoin(orderAlias: string, paymentAlias: string): string {
  return `LEFT JOIN payments ${paymentAlias} ON ${paymentAlias}.order_reference = ${orderAlias}.order_number`
}

/**
 * Net order amount: total minus whatever was already refunded (0 when the
 * order has no payment row, e.g. cash on delivery). Fully-refunded orders
 * are excluded by financialOrdersWhere(); partially-refunded ones count
 * at net value through this expression.
 */
export function netOrderTotal(orderAlias: string, paymentAlias: string): string {
  return `(${orderAlias}.total - COALESCE(${paymentAlias}.refunded_amount, 0))`
}
