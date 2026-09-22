import { db, pool, dbForClient } from '@/lib/db'
import { orders, orderItems, orderHistory, promotions } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { recordPromotionUsageInternal } from '@/lib/shop/promo-usage'
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
    await q.query(
      `UPDATE product_variants
          SET quantity = GREATEST(0, quantity + $1::int * $2::int),
              is_in_stock = GREATEST(0, quantity + $1::int * $2::int) > 0
        WHERE id = $3`,
      [sign, qty, variantId],
    )
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
        delta: sign * qty,
        quantityAfter: Number(res.rows[0]?.quantity),
        reason: sign === 1 ? 'cancel' : 'sale',
        orderId,
        actor: 'System',
      },
      q,
    )
    return
  }
  const res = await q.query(
    `UPDATE products SET quantity = GREATEST(0, quantity + $1::int * $2::int),
        is_in_stock = GREATEST(0, quantity + $1::int * $2::int) > 0 WHERE id = $3 RETURNING quantity`,
    [sign, qty, productId],
  )
  await recordStockMovement(
    {
      productId,
      variantId: null,
      delta: sign * qty,
      quantityAfter: Number(res.rows[0]?.quantity),
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
 */
export async function restoreStockOnce(orderId: number, client?: PoolClient): Promise<boolean> {
  if (!(await claimStockRestore(orderId, client))) return false
  await adjustStockForOrder(orderId, 1, client)
  return true
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
 */
export async function applyOrderFulfillment(orderId: number, client?: PoolClient): Promise<void> {
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
  // here. The UPDATE is now conditional (`quantity >= $1`) so it can never take
  // stock negative and never silently double-fulfills more than what's on hand —
  // but that means the *second* order to arrive here may genuinely not have real
  // stock behind it. Rather than fail the (already-placed, possibly already-paid)
  // order, we flag it clearly for the admin to reconcile manually instead of
  // silently shipping/promising stock that doesn't exist.
  const oversold: { name: string; variantLabel: string | null; requested: number }[] = []
  const variantProductIds = new Set<number>()
  const productOrderBumps = new Map<number, number>()

  for (const i of items) {
    if (i.variantId != null) {
      const variantRes = await q.query(
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
    const details = oversold
      .map((o) => `«${o.name}»${o.variantLabel ? ` (${o.variantLabel})` : ''} × ${o.requested}`)
      .join(', ')
    const warning = `⚠ Недостаточно остатка на складе на момент подтверждения заказа: ${details}. Проверьте наличие перед отправкой.`
    await tx
      .insert(orderHistory)
      .values({ orderId, type: 'note', message: warning, actor: 'System' })
      .catch(() => {})
  }

  const total = Number(order.total)

  // Customer lifetime stats.
  if (order.customerId) {
    await q
      .query(
        `UPDATE customers SET orders_count = orders_count + 1, total_turnover = total_turnover + $1, last_order_date = NOW() WHERE id = $2`,
        [total, order.customerId],
      )
      .catch(() => {})
  }

  // Promo usage + timeline note. discountTotal can be the sum of a manually
  // entered promo code AND an automatic ("type: discount") promotion applied
  // at the same time (see createStorefrontOrder) — autoDiscountAmount is the
  // slice attributed to the automatic promotion, the remainder (if any) to
  // the promo code, so both get their usage stats recorded without
  // double-counting either one.
  const totalDiscount = Number(order.discountTotal)
  const autoAmount = Number(order.autoDiscountAmount || 0)
  const manualAmount = Math.max(0, totalDiscount - autoAmount)

  if (order.promoCode && manualAmount > 0) {
    const [promo] = await tx
      .select({ id: promotions.id })
      .from(promotions)
      .where(sql`UPPER(${promotions.promoCode}) = ${order.promoCode.toUpperCase()}`)
      .limit(1)
    if (promo) {
      await recordPromotionUsageInternal({
        promotionId: promo.id,
        orderReference: order.orderNumber,
        orderAmount: total,
        discountAmount: manualAmount,
      }).catch(() => {})
      await tx
        .insert(orderHistory)
        .values({
          orderId,
          type: 'note',
          message: `Промокод ${order.promoCode} — ${manualAmount.toFixed(2)} ₴`,
          actor: order.customerName ?? 'System',
        })
        .catch(() => {})
    }
  }

  if (order.autoDiscountId && autoAmount > 0) {
    await recordPromotionUsageInternal({
      promotionId: order.autoDiscountId,
      orderReference: order.orderNumber,
      orderAmount: total,
      discountAmount: autoAmount,
    }).catch(() => {})
    await tx
      .insert(orderHistory)
      .values({
        orderId,
        type: 'note',
        message: `Автознижка — ${autoAmount.toFixed(2)} ₴`,
        actor: order.customerName ?? 'System',
      })
      .catch(() => {})
  }

  // Record the sale for analytics.
  await q
    .query(`INSERT INTO analytics_events (type, order_id, amount) VALUES ('order', $1, $2)`, [
      orderId,
      total,
    ])
    .catch(() => {})
}

/**
 * Promotes an online order from "pending_payment" to a real order once payment
 * is confirmed. Atomically claims the transition so fulfillment runs exactly
 * once even if multiple gateway callbacks / status checks race.
 */
export async function finalizePaidOrder(orderNumber: string): Promise<void> {
  const claim = await pool.query(
    `UPDATE orders SET status = 'new', updated_at = NOW() WHERE order_number = $1 AND status = 'pending_payment' RETURNING id`,
    [orderNumber],
  )
  if (claim.rowCount && claim.rows[0]) {
    const orderId = Number(claim.rows[0].id)
    await applyOrderFulfillment(orderId)
    // Online orders notify only after the payment is confirmed.
    const { notifyNewOrder } = await import('@/lib/notifications')
    void notifyNewOrder(orderId)
  }
}
