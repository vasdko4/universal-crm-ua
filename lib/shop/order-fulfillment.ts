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
  const items = client
    ? (await client.query(`SELECT * FROM order_items WHERE order_id = $1`, [orderId])).rows
    : await db.select().from(orderItems).where(eq(orderItems.orderId, orderId))
  for (const item of items) {
    const productId = Number(item.productId ?? item.product_id)
    const variantId = item.variantId ?? item.variant_id
    const quantity = Number(item.quantity)
    if (productId) {
      const res = await q.query(
        `UPDATE products SET quantity = GREATEST(0, quantity + $1::int * $2::int) WHERE id = $3 RETURNING quantity`,
        [sign, quantity, productId],
      )
      await recordStockMovement(
        {
          productId,
          variantId: variantId != null ? Number(variantId) : null,
          delta: sign * quantity,
          quantityAfter: Number(res.rows[0]?.quantity),
          reason: sign === 1 ? 'cancel' : 'sale',
          orderId,
          actor: 'System',
        },
        q,
      )
    }
  }
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
      // products.quantity is the maintained aggregate of all variant
      // quantities (see aggQty in app/actions/products.ts) — the admin
      // products list, low-stock dashboard widget and "in stock" filters all
      // read this column directly, so it must stay in lockstep with the
      // variant decrement above, not just the is_in_stock flag.
      await q.query(
        `UPDATE products SET orders_count = COALESCE(orders_count,0) + 1,
           quantity = COALESCE((SELECT SUM(quantity) FROM product_variants WHERE product_id = $1), 0),
           is_in_stock = COALESCE((SELECT SUM(quantity) FROM product_variants WHERE product_id = $1), 0) > 0 WHERE id = $1`,
        [i.productId],
      )
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
        // Still count the order towards orders_count even when oversold —
        // only the stock/is_in_stock columns are conditional on availability.
        await q
          .query(`UPDATE products SET orders_count = COALESCE(orders_count,0) + 1 WHERE id = $1`, [i.productId])
          .catch(() => {})
        oversold.push({ name: i.name, variantLabel: i.variantLabel, requested: i.quantity })
      }
    }
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
