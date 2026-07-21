import { db, pool } from '@/lib/db'
import { orders, orderItems, orderHistory, promotions } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { recordPromotionUsage } from '@/app/actions/promotions'

/**
 * Applies the real-world side effects of a placed order exactly once:
 * decrements inventory, updates customer stats, records promo usage, and logs
 * the sale as an analytics event.
 *
 * For cash/requisite orders this runs immediately at order creation. For online
 * gateway orders it is deferred until the payment is confirmed (see
 * finalizePaidOrder) so abandoned/unpaid checkouts never touch stock or promos.
 */
export async function applyOrderFulfillment(orderId: number): Promise<void> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  if (!order) return

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId))

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
      const variantRes = await pool.query(
        `UPDATE product_variants SET quantity = quantity - $1, is_in_stock = (quantity - $1) > 0
         WHERE id = $2 AND quantity >= $1 RETURNING quantity`,
        [i.quantity, i.variantId],
      )
      if (variantRes.rowCount === 0) {
        oversold.push({ name: i.name, variantLabel: i.variantLabel, requested: i.quantity })
      }
      // products.quantity is the maintained aggregate of all variant
      // quantities (see aggQty in app/actions/products.ts) — the admin
      // products list, low-stock dashboard widget and "in stock" filters all
      // read this column directly, so it must stay in lockstep with the
      // variant decrement above, not just the is_in_stock flag.
      await pool.query(
        `UPDATE products SET orders_count = COALESCE(orders_count,0) + 1,
           quantity = COALESCE((SELECT SUM(quantity) FROM product_variants WHERE product_id = $1), 0),
           is_in_stock = COALESCE((SELECT SUM(quantity) FROM product_variants WHERE product_id = $1), 0) > 0 WHERE id = $1`,
        [i.productId],
      )
    } else if (i.productId != null) {
      const productRes = await pool.query(
        `UPDATE products SET quantity = quantity - $1, orders_count = COALESCE(orders_count,0) + 1,
           is_in_stock = (quantity - $1) > 0
         WHERE id = $2 AND quantity >= $1 RETURNING quantity`,
        [i.quantity, i.productId],
      )
      if (productRes.rowCount === 0) {
        // Still count the order towards orders_count even when oversold —
        // only the stock/is_in_stock columns are conditional on availability.
        await pool
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
    await db
      .insert(orderHistory)
      .values({ orderId, type: 'note', message: warning, actor: 'Система' })
      .catch(() => {})
    await pool
      .query(`UPDATE orders SET note = COALESCE(note || E'\n', '') || $1 WHERE id = $2`, [warning, orderId])
      .catch(() => {})
  }

  const total = Number(order.total)

  // Customer lifetime stats.
  if (order.customerId) {
    await pool
      .query(
        `UPDATE customers SET orders_count = orders_count + 1, total_turnover = total_turnover + $1, last_order_date = NOW() WHERE id = $2`,
        [total, order.customerId],
      )
      .catch(() => {})
  }

  // Promo usage + timeline note (resolve the promotion by its saved code).
  const discount = Number(order.discountTotal)
  if (order.promoCode && discount > 0) {
    const [promo] = await db
      .select({ id: promotions.id })
      .from(promotions)
      .where(sql`UPPER(${promotions.promoCode}) = ${order.promoCode.toUpperCase()}`)
      .limit(1)
    if (promo) {
      await recordPromotionUsage({
        promotionId: promo.id,
        orderReference: order.orderNumber,
        orderAmount: total,
        discountAmount: discount,
      }).catch(() => {})
      await db
        .insert(orderHistory)
        .values({
          orderId,
          type: 'note',
          message: `Применён промокод ${order.promoCode} — скидка ${discount.toFixed(2)} грн`,
          actor: order.customerName ?? 'Система',
        })
        .catch(() => {})
    }
  }

  // Record the sale for analytics.
  await pool
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
