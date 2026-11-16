import { sql, type SQL } from 'drizzle-orm'
import { pool } from '@/lib/db'
import { financialOrdersWhere } from '@/lib/analytics/financial'

/**
 * Honest purchase counter (fix #1, 3.4.104).
 *
 * The storefront "Купили N разів" badge used to read the denormalized
 * `products.orders_count`, which `applyOrderFulfillment`
 * (lib/shop/order-fulfillment.ts) bumps by +1 per order line the moment an
 * order is placed — and nothing ever decremented it. A cancelled test order
 * therefore counted forever (ACEFAST C16-03 showed "Купили 2 рази" from two
 * cancelled test orders), and so did unpaid `pending_payment` checkouts and
 * fully-refunded orders.
 *
 * The displayed count is now DERIVED from real orders at read time, so it
 * can never drift: a cancel, a refund or an abandoned checkout changes the
 * count the moment the order row changes, with no counter to keep in sync.
 * The predicate is the codebase's single definition of a real sale —
 * `financialOrdersWhere()` (lib/analytics/financial.ts, audit P1, 3.4.96),
 * the same one the bestsellers report and every financial report use:
 *   status NOT IN ('cancelled', 'pending_payment')
 *   AND payment_status <> 'refunded'
 * A cash-on-delivery order in status 'new'/'shipped' with payment_status
 * 'unpaid' IS a real order (stock was deducted, the buyer is real), so it
 * counts; only cancelled, never-paid online checkouts and fully-refunded
 * orders are excluded.
 *
 * The count is per ORDER (COUNT DISTINCT order_id), not per order line: an
 * order with two lines of the same product (e.g. two variants) is one
 * purchase, matching the bestsellers report's orders_count.
 *
 * The denormalized `products.orders_count` column is NOT removed: it still
 * feeds the `ordersCount + purchasesBoost` sort (lib/shop/queries.ts) and
 * `purchasesBoost` stays sort-only — it is never added to the displayed
 * count. Run `scripts/recompute-orders-count.mjs` to re-sync the stored
 * column with the same predicate after this fix lands.
 */

/**
 * Correlated subquery for the storefront product select: the real purchase
 * count for the product of the current `products` row. Used as the
 * `orders_count` field of `buildProductSelect` (lib/shop/queries.ts), which
 * is the single choke point every storefront product read flows through.
 * Index-backed by `idx_order_items_product` (db/schema.sql).
 *
 * NOTE: the product id must be spelled out as `"products"."id"` via
 * `sql.identifier` — interpolating the `products.id` column object renders
 * a bare `"id"`, which is ambiguous inside this subquery because `orders`
 * has an `id` column too (Postgres error 42702).
 */
export function realPurchaseCountSql(): SQL<number> {
  return sql<number>`(SELECT COUNT(DISTINCT oi.order_id)::int
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
   WHERE oi.product_id = ${sql.identifier('products')}.${sql.identifier('id')}
     AND ${sql.raw(financialOrdersWhere('o'))})`
}

/** Real purchase count for one product (admin product form cross-check). */
export async function getRealOrdersCount(productId: number): Promise<number> {
  const { rows } = await pool.query<{ c: string }>(
    `SELECT COUNT(DISTINCT oi.order_id)::int AS c
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
      WHERE oi.product_id = $1
        AND ${financialOrdersWhere('o')}`,
    [productId],
  )
  return Number(rows[0]?.c ?? 0)
}
