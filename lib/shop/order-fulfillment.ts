import { db, pool, dbForClient } from '@/lib/db'
import { orders, orderItems, orderHistory } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { recordPromoUsageForOrder } from '@/lib/shop/promo-usage'
import { recordStockMovement, type QueryExecutor } from '@/lib/shop/stock-ledger'
import type { PoolClient } from 'pg'

function exec(client?: PoolClient): QueryExecutor {
  return client ?? pool
}

/**
 * `sign: 1` restores stock (cancel / full refund), `sign: -1` re-deducts it.
 * Used by status flips and by gateway refunds so both paths share one ledger.
 */
export async function adjustStockForOrder(orderId: number, sign: 1 | -1, client?: PoolClient) {
  const q = exec(client)
  // Restore (sign +1): outstanding deduction = -net(sale+cancel). Oversold
  // lines never wrote a `sale` movement, so they must not be added back.
  // Re-deduct (sign -1): unmatched restore = cancel rows after that line's
  // latest sale. After a full restore the net is 0, so SUM(delta) cannot
  // drive reopen — that left phantom stock on every cancel→reopen cycle.
  const ledger = await q.query<{
    product_id: number
    variant_id: number | null
    qty: string
  }>(
    `WITH last_sale AS (
       SELECT product_id, variant_id, MAX(created_at) AS at
         FROM stock_movements
        WHERE order_id = $1 AND reason = 'sale'
        GROUP BY product_id, variant_id
     )
     SELECT m.product_id, m.variant_id,
            CASE WHEN $2::int = 1
                 THEN GREATEST(0, -SUM(m.delta))::int
                 ELSE GREATEST(0, SUM(m.delta) FILTER (
                        WHERE m.reason = 'cancel'
                          AND m.created_at >= COALESCE(ls.at, '-infinity'::timestamptz)
                      ))::int
            END AS qty
       FROM stock_movements m
       LEFT JOIN last_sale ls
         ON ls.product_id = m.product_id
        AND ls.variant_id IS NOT DISTINCT FROM m.variant_id
      WHERE m.order_id = $1 AND m.reason IN ('sale', 'cancel')
      GROUP BY m.product_id, m.variant_id, ls.at
     HAVING (CASE WHEN $2::int = 1
                  THEN GREATEST(0, -SUM(m.delta))
                  ELSE GREATEST(0, SUM(m.delta) FILTER (
                         WHERE m.reason = 'cancel'
                           AND m.created_at >= COALESCE(ls.at, '-infinity'::timestamptz)
                       ))
             END) > 0`,
    [orderId, sign],
  )
  const rows = ledger.rows
  if (rows.length === 0) {
    // Empty *net* is not the same as a pre-ledger order. Oversold lines and
    // unpaid online checkouts never wrote a `sale` movement — falling back to
    // order_items.quantity would invent stock that never left the warehouse.
    // Only orders placed before the first ledger write may use that fallback.
    const anyLedger = await q.query(
      `SELECT 1 FROM stock_movements WHERE order_id = $1 AND reason IN ('sale', 'cancel') LIMIT 1`,
      [orderId],
    )
    if (anyLedger.rowCount) return
    const legacy = await q.query<{ allow: boolean }>(
      `SELECT (o.created_at < (SELECT MIN(created_at) FROM stock_movements)) AS allow
         FROM orders o WHERE o.id = $1`,
      [orderId],
    )
    if (!legacy.rows[0]?.allow) return
    const items = await q.query<{ product_id: number | null; variant_id: number | null; quantity: number }>(
      `SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = $1`,
      [orderId],
    )
    for (const item of items.rows) {
      const productId = Number(item.product_id)
      if (!productId) continue
      await bumpProductStock(q, {
        productId,
        variantId: item.variant_id != null ? Number(item.variant_id) : null,
        qty: Number(item.quantity),
        sign,
        orderId,
      })
    }
    return
  }
  for (const row of rows) {
    await bumpProductStock(q, {
      productId: Number(row.product_id),
      variantId: row.variant_id != null ? Number(row.variant_id) : null,
      qty: Number(row.qty),
      sign,
      orderId,
    })
  }
}

async function bumpProductStock(
  q: QueryExecutor,
  input: { productId: number; variantId: number | null; qty: number; sign: 1 | -1; orderId: number },
) {
  const { productId, variantId, qty, sign, orderId } = input
  if (variantId != null) {
    // Atomic read-modify-write: one statement returns the quantity before
    // and after the clamped UPDATE, so concurrent bumps can't make the
    // ledger record a stale (phantom) delta. Both CTEs see the statement
    // snapshot — before_qty is the pre-UPDATE value.
    const { rows } = await q.query<{ before_qty: string; after_qty: string }>(
      `WITH before_qty AS (
         SELECT quantity FROM product_variants WHERE id = $3
       ),
       updated AS (
         UPDATE product_variants
            SET quantity = GREATEST(0, quantity + $1::int * $2::int),
                is_in_stock = GREATEST(0, quantity + $1::int * $2::int) > 0
          WHERE id = $3
         RETURNING quantity
       )
       SELECT (SELECT quantity FROM before_qty) AS before_qty,
              (SELECT quantity FROM updated) AS after_qty`,
      [sign, qty, variantId],
    )
    const beforeVarQty = Math.max(0, Number(rows[0]?.before_qty ?? 0))
    const afterVarQty = Math.max(0, Number(rows[0]?.after_qty ?? 0))
    const actualQty = sign === -1 ? beforeVarQty - afterVarQty : afterVarQty - beforeVarQty
    const res = await q.query(
      `UPDATE products SET
          quantity = COALESCE((SELECT SUM(quantity) FROM product_variants WHERE product_id = $1), 0),
          is_in_stock = COALESCE((SELECT SUM(quantity) FROM product_variants WHERE product_id = $1), 0) > 0
        WHERE id = $1 RETURNING quantity`,
      [productId],
    )
    await recordStockMovement(
      {
        productId,
        variantId,
        delta: sign * actualQty,
        quantityAfter: Number(res.rows[0]?.quantity),
        reason: sign === 1 ? 'cancel' : 'sale',
        orderId,
        actor: 'System',
      },
      q,
    )
    return
  }
  // Same atomic read-modify-write as the variant branch above.
  const { rows } = await q.query<{ before_qty: string; after_qty: string }>(
    `WITH before_qty AS (
       SELECT quantity FROM products WHERE id = $3
     ),
     updated AS (
       UPDATE products
          SET quantity = GREATEST(0, quantity + $1::int * $2::int),
              is_in_stock = GREATEST(0, quantity + $1::int * $2::int) > 0
        WHERE id = $3
       RETURNING quantity
     )
     SELECT (SELECT quantity FROM before_qty) AS before_qty,
            (SELECT quantity FROM updated) AS after_qty`,
    [sign, qty, productId],
  )
  const beforeProdQty = Math.max(0, Number(rows[0]?.before_qty ?? 0))
  const afterProdQty = Math.max(0, Number(rows[0]?.after_qty ?? 0))
  const actualProdQty = sign === -1 ? beforeProdQty - afterProdQty : afterProdQty - beforeProdQty
  await recordStockMovement(
    {
      productId,
      variantId: null,
      delta: sign * actualProdQty,
      quantityAfter: afterProdQty,
      reason: sign === 1 ? 'cancel' : 'sale',
      orderId,
      actor: 'System',
    },
    q,
  )
}

/**
 * Atomically claim the one-time restock for an order. Returns true only for
 * the caller that flipped `stock_restored` from false → true, so concurrent
 * cancel + refund + webhook cannot inflate inventory.
 */
export async function claimStockRestore(orderId: number, client?: PoolClient): Promise<boolean> {
  const q = exec(client)
  const res = await q.query(
    `UPDATE orders SET stock_restored = true, updated_at = NOW()
      WHERE id = $1 AND stock_restored IS NOT TRUE
      RETURNING id`,
    [orderId],
  )
  return Boolean(res.rowCount)
}

/**
 * Atomically claim a re-deduct after a cancelled order is reopened.
 */
export async function claimStockRededuct(orderId: number, client?: PoolClient): Promise<boolean> {
  const q = exec(client)
  const res = await q.query(
    `UPDATE orders SET stock_restored = false, updated_at = NOW()
      WHERE id = $1 AND stock_restored IS TRUE
      RETURNING id`,
    [orderId],
  )
  return Boolean(res.rowCount)
}

/**
 * Restore stock for a fully refunded / cancelled order exactly once.
 * Safe to call from admin cancel, admin refund, and gateway webhooks.
 *
 * The claim and the restore are atomic: with a transaction client they run
 * on the caller's transaction; without one this function opens its own
 * (BEGIN … COMMIT), so a transient DB error mid-restore rolls the claim
 * back and a retry can redo the work instead of leaving stock partially
 * restored with the flag already consumed and invisible.
 */
export async function restoreStockOnce(orderId: number, client?: PoolClient): Promise<boolean> {
  if (client) {
    if (!(await claimStockRestore(orderId, client))) return false
    await adjustStockForOrder(orderId, 1, client)
    return true
  }
  const owned = await pool.connect()
  try {
    await owned.query('BEGIN')
    if (!(await claimStockRestore(orderId, owned))) {
      await owned.query('ROLLBACK')
      return false
    }
    await adjustStockForOrder(orderId, 1, owned)
    await owned.query('COMMIT')
    return true
  } catch (e) {
    await owned.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    owned.release()
  }
}

export type OversoldItem = { name: string; variantLabel: string | null; requested: number }

/**
 * Thrown by applyOrderFulfillment in strict mode when the atomic
 * `UPDATE ... WHERE quantity >= $1` reservation fails for at least one line.
 * Callers running inside the order-creation transaction let this propagate so
 * the whole order rolls back — a lost stock race then surfaces as a clean
 * "items unavailable" failure instead of a committed order with no stock
 * behind it.
 */
export class InsufficientStockError extends Error {
  items: OversoldItem[]
  constructor(items: OversoldItem[]) {
    super(
      `Insufficient stock: ${items
        .map((o) => `«${o.name}»${o.variantLabel ? ` (${o.variantLabel})` : ''} × ${o.requested}`)
        .join(', ')}`,
    )
    this.name = 'InsufficientStockError'
    this.items = items
  }
}

/**
 * Applies the real-world side effects of a placed order exactly once:
 * decrements inventory, updates customer stats, records promo usage, and logs
 * the sale as an analytics event.
 *
 * For cash/requisite orders this runs immediately at order creation. For online
 * gateway orders it is deferred until the payment is confirmed (see
 * finalizePaidOrder) so abandoned/unpaid checkouts never touch stock or promos.
 *
 * Pass `client` when the caller already holds a transaction (checkout) so
 * stock writes roll back with the order row.
 *
 * Pass `{ strictStock: true }` when the caller runs inside the order-creation
 * transaction: a failed reservation then throws InsufficientStockError and
 * aborts the whole order instead of leaving an oversold order behind.
 * finalizePaidOrder (money already captured) passes `{ strictPromo: false }`
 * and leaves stock non-strict: a missed promo increment is logged to order
 * history instead of throwing (a throw there would leave a paid order stuck
 * in pending_payment), and an oversold line is flagged for manual
 * reconciliation instead of silently promising missing stock.
 */
export async function applyOrderFulfillment(
  orderId: number,
  client?: PoolClient,
  opts?: { strictStock?: boolean; strictPromo?: boolean },
): Promise<void> {
  const q = exec(client)
  const tx = client ? dbForClient(client) : db

  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  if (!order) return

  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId))

  // Decrement stock, keeping product aggregate quantity in sync with variants.
  //
  // RACE CONDITION NOTE: the availability check at checkout (createStorefrontOrder)
  // and this decrement happen at different times, so two concurrent checkouts for
  // the last unit(s) of a product can both pass the earlier check and both land
  // here. The UPDATE is conditional (`quantity >= $1`) so it can never take stock
  // negative and never silently double-fulfills more than what's on hand. In
  // strict mode (order-creation transaction) the loser of the race throws
  // InsufficientStockError and the whole order rolls back; in non-strict mode
  // (finalizePaidOrder, money already captured) the order is flagged for the
  // admin to reconcile manually instead of silently promising missing stock.
  const oversold: { name: string; variantLabel: string | null; requested: number }[] = []
  const variantProductIds = new Set<number>()
  const productOrderBumps = new Map<number, number>()

  // Preorder products are sold on demand: checkout lets them through at
  // zero stock, so fulfillment must not try to deduct — the conditional
  // UPDATE would fail and the line would land in `oversold` (or abort the
  // whole order in strict mode). The orders_count bump still applies.
  const preorderIds = new Set<number>()
  {
    const ids = [...new Set(items.map((i) => i.productId).filter((x): x is number => x != null))]
    if (ids.length > 0) {
      const { rows } = await q.query<{ id: number; availability_mode: string }>(
        `SELECT id, availability_mode FROM products WHERE id = ANY($1::int[])`,
        [ids],
      )
      for (const r of rows) {
        if (r.availability_mode === 'preorder') preorderIds.add(Number(r.id))
      }
    }
  }

  for (const i of items) {
    if (i.variantId != null) {
      if (i.productId != null && preorderIds.has(i.productId)) {
        variantProductIds.add(i.productId)
        productOrderBumps.set(i.productId, (productOrderBumps.get(i.productId) ?? 0) + 1)
        continue
      }
      // BUGFIX: deduct from the variant of THIS product only — without the
      // product_id condition a mismatched variantId (e.g. from an admin order)
      // silently drained a different product's variant.
      const variantRes =
        i.productId != null
          ? await q.query(
              `UPDATE product_variants SET quantity = quantity - $1, is_in_stock = (quantity - $1) > 0
               WHERE id = $2 AND product_id = $3 AND quantity >= $1 RETURNING quantity`,
              [i.quantity, i.variantId, i.productId],
            )
          : await q.query(
              `UPDATE product_variants SET quantity = quantity - $1, is_in_stock = (quantity - $1) > 0
               WHERE id = $2 AND quantity >= $1 RETURNING quantity`,
              [i.quantity, i.variantId],
            )
      if (variantRes.rowCount === 0) {
        oversold.push({ name: i.name, variantLabel: i.variantLabel, requested: i.quantity })
      } else if (i.productId != null) {
        await recordStockMovement(
          {
            productId: i.productId,
            variantId: i.variantId,
            delta: -i.quantity,
            quantityAfter: Number(variantRes.rows[0]?.quantity),
            reason: 'sale',
            orderId,
            actor: 'System',
          },
          q,
        )
      }
      if (i.productId != null) {
        variantProductIds.add(i.productId)
        productOrderBumps.set(i.productId, (productOrderBumps.get(i.productId) ?? 0) + 1)
      }
    } else if (i.productId != null) {
      if (preorderIds.has(i.productId)) {
        productOrderBumps.set(i.productId, (productOrderBumps.get(i.productId) ?? 0) + 1)
        continue
      }
      const productRes = await q.query(
        `UPDATE products SET quantity = quantity - $1, orders_count = COALESCE(orders_count,0) + 1,
           is_in_stock = (quantity - $1) > 0
         WHERE id = $2 AND quantity >= $1 RETURNING quantity`,
        [i.quantity, i.productId],
      )
      if (productRes.rowCount && i.productId != null) {
        await recordStockMovement(
          {
            productId: i.productId,
            delta: -i.quantity,
            quantityAfter: Number(productRes.rows[0]?.quantity),
            reason: 'sale',
            orderId,
            actor: 'System',
          },
          q,
        )
      }
      if (productRes.rowCount === 0) {
        productOrderBumps.set(i.productId, (productOrderBumps.get(i.productId) ?? 0) + 1)
        oversold.push({ name: i.name, variantLabel: i.variantLabel, requested: i.quantity })
      }
    }
  }

  // One aggregate recompute per parent product, not per variant line (M4).
  for (const productId of variantProductIds) {
    const bumps = productOrderBumps.get(productId) ?? 0
    await q.query(
      `UPDATE products SET orders_count = COALESCE(orders_count,0) + $2,
         quantity = COALESCE((SELECT SUM(quantity) FROM product_variants WHERE product_id = $1), 0),
         is_in_stock = COALESCE((SELECT SUM(quantity) FROM product_variants WHERE product_id = $1), 0) > 0 WHERE id = $1`,
      [productId, bumps],
    )
  }
  for (const [productId, bumps] of productOrderBumps) {
    if (variantProductIds.has(productId)) continue
    await q.query(
      `UPDATE products SET orders_count = COALESCE(orders_count,0) + $2 WHERE id = $1`,
      [productId, bumps],
    )
  }

  if (oversold.length > 0) {
    if (opts?.strictStock) {
      // Inside the order-creation transaction: abort everything so no
      // oversold order is ever committed.
      throw new InsufficientStockError(oversold)
    }
    const details = oversold
      .map((o) => `«${o.name}»${o.variantLabel ? ` (${o.variantLabel})` : ''} × ${o.requested}`)
      .join(', ')
    const warning = `⚠ Недостаточно остатка на складе на момент подтверждения заказа: ${details}. Проверьте наличие перед отправкой.`
    await q.query(
      `INSERT INTO order_history (order_id, type, message, actor) VALUES ($1, 'note', $2, 'System')`,
      [orderId, warning],
    )
  }

  // Promo usage on the same connection as the order (FIX-11). Strict by
  // default when a transaction client is present (checkout aborts if the
  // limit is already taken). finalizePaidOrder passes strictPromo: false
  // explicitly: money is already captured there, so a missed increment is
  // logged to order history instead of rolling the paid order back to
  // pending_payment (A1).
  await recordPromoUsageForOrder(
    {
      orderId,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      promoCode: order.promoCode,
      discountTotal: order.discountTotal,
      autoDiscountId: order.autoDiscountId,
      autoDiscountAmount: order.autoDiscountAmount,
      total: order.total,
    },
    client,
    { strict: opts?.strictPromo ?? client != null },
  )

  // Customer stats / analytics on the same executor as the order (A2), not
  // the pool: a pool connection cannot see the uncommitted new-customer row
  // of the same checkout transaction (READ COMMITTED), so a first order's
  // stats were silently never bumped — and pool writes auto-commit, so a
  // rollback left an orphaned analytics row behind. A stats failure still
  // must not abort the order (FIX-12) — it is logged instead.
  const total = Number(order.total)
  if (order.customerId) {
    try {
      await q.query(
        `UPDATE customers SET orders_count = orders_count + 1, total_turnover = total_turnover + $1, last_order_date = NOW() WHERE id = $2`,
        [total, order.customerId],
      )
    } catch (e) {
      console.error('[fulfillment] customer stats update failed', {
        orderId,
        error: (e as Error)?.message,
      })
    }
  }
  try {
    await q.query(`INSERT INTO analytics_events (type, order_id, amount) VALUES ('order', $1, $2)`, [orderId, total])
  } catch (e) {
    console.error('[fulfillment] analytics event insert failed', {
      orderId,
      error: (e as Error)?.message,
    })
  }
}

/**
 * The claim + fulfillment half of finalizePaidOrder, on a caller-owned
 * connection. Returns the finalized order id, or null when another caller
 * already claimed the order (status no longer pending_payment).
 */
async function claimAndFulfillPaidOrder(orderNumber: string, client: PoolClient): Promise<number | null> {
  const claim = await client.query(
    `UPDATE orders SET status = 'new', updated_at = NOW() WHERE order_number = $1 AND status = 'pending_payment' RETURNING id`,
    [orderNumber],
  )
  if (!claim.rowCount || !claim.rows[0]) return null
  const orderId = Number(claim.rows[0].id)
  // Money is already captured: a missed promo increment must not throw and
  // roll the paid order back to pending_payment (A1) — the non-strict
  // branch of recordPromoUsageForOrder logs it to order history instead.
  await applyOrderFulfillment(orderId, client, { strictPromo: false })
  return orderId
}

/**
 * Promotes an online order from "pending_payment" to a real order once payment
 * is confirmed. The claim and the fulfillment run in ONE transaction, so a
 * fulfillment failure rolls the order back to pending_payment instead of
 * leaving it half-fulfilled as 'new' with no way to retry: the claim
 * (`UPDATE ... WHERE status = 'pending_payment'`) only matches an unclaimed
 * order, so a later retry (webhook/status check) safely re-runs it. The
 * notification stays outside the transaction — best-effort, after commit.
 *
 * Pass a transaction client when the caller already holds one
 * (updateOrderPayment): the claim + fulfillment then commit (or roll back)
 * with the caller's change, the claimed order id is returned, and the caller
 * notifies after ITS commit. Without a client the old behavior is kept: own
 * transaction + notify after commit. Returns the finalized order id, or null
 * when nothing was claimed.
 */
export async function finalizePaidOrder(orderNumber: string, client?: PoolClient): Promise<number | null> {
  if (client) return claimAndFulfillPaidOrder(orderNumber, client)
  const owned = await pool.connect()
  let orderId: number | null = null
  try {
    await owned.query('BEGIN')
    orderId = await claimAndFulfillPaidOrder(orderNumber, owned)
    await owned.query('COMMIT')
  } catch (e) {
    await owned.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    owned.release()
  }
  if (orderId != null) {
    // Online orders notify only after the payment is confirmed.
    const { notifyNewOrder } = await import('@/lib/notifications')
    void notifyNewOrder(orderId)
  }
  return orderId
}
