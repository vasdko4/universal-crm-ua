import { db, dbForClient } from '@/lib/db'
import { promotions, promotionUsages, orderHistory } from '@/lib/db/schema'
import { and, asc, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import type { PoolClient } from 'pg'

/**
 * Records that a promotion was applied to an order. Server-only — never
 * export this from a 'use server' file. The public action
 * `recordPromotionUsage` in app/actions/promotions.ts is admin-gated and
 * must not be the path checkout fulfillment uses.
 *
 * When `client` is the checkout transaction, the increment lives on the
 * same connection as the order insert (FIX-11). Without it, a parallel
 * order can keep the discount after this one rolls back.
 */
export async function recordPromotionUsageInternal(
  input: {
    promotionId: number
    orderReference?: string
    orderAmount: number
    discountAmount: number
  },
  client?: PoolClient,
): Promise<{ success: boolean; counted: boolean }> {
  const withinLimit = sql`(${promotions.usageLimit} IS NULL OR ${promotions.usedCount} < ${promotions.usageLimit})`
  const values = {
    usedCount: sql`${promotions.usedCount} + 1`,
    totalOrdersAmount: sql`${promotions.totalOrdersAmount} + ${input.orderAmount}`,
    totalDiscountAmount: sql`${promotions.totalDiscountAmount} + ${input.discountAmount}`,
    updatedAt: new Date(),
  }
  const usageRow = {
    promotionId: input.promotionId,
    orderReference: input.orderReference ?? null,
    orderAmount: String(input.orderAmount),
    discountAmount: String(input.discountAmount),
  }

  let counted: boolean
  if (client) {
    const tx = dbForClient(client)
    const [updated] = await tx
      .update(promotions)
      .set(values)
      .where(and(eq(promotions.id, input.promotionId), withinLimit))
      .returning({ id: promotions.id })
    await tx.insert(promotionUsages).values(usageRow)
    counted = Boolean(updated)
  } else {
    counted = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(promotions)
        .set(values)
        .where(and(eq(promotions.id, input.promotionId), withinLimit))
        .returning({ id: promotions.id })
      await tx.insert(promotionUsages).values(usageRow)
      return Boolean(updated)
    })
  }

  revalidatePath('/admin/promotions')
  return { success: true, counted }
}

export type OrderPromoFields = {
  orderId: number
  orderNumber: string
  customerName?: string | null
  promoCode?: string | null
  discountTotal?: string | number | null
  autoDiscountId?: number | null
  autoDiscountAmount?: string | number | null
  total?: string | number | null
}

/**
 * Records promo usage for an order from its stored promo fields.
 * Extracted from applyOrderFulfillment (identical semantics) so the admin
 * "reopen cancelled order" path can re-claim usage the same way checkout
 * claims it.
 *
 * strict=true (inside the checkout transaction): a missed limit bump aborts
 * the flow with 'promo-limit', exactly as before. strict=false (reopen):
 * the limit may have been taken while the order was cancelled — the miss is
 * logged to order history instead of failing, and the order keeps its
 * discount without consuming a slot.
 */
export async function recordPromoUsageForOrder(
  order: OrderPromoFields,
  client?: PoolClient,
  opts?: { strict?: boolean },
): Promise<void> {
  const strict = opts?.strict ?? false
  const tx = client ? dbForClient(client) : db
  const total = Number(order.total ?? 0)
  const totalDiscount = Number(order.discountTotal ?? 0)
  const autoAmount = Number(order.autoDiscountAmount ?? 0)
  const manualAmount = Math.max(0, totalDiscount - autoAmount)
  const actor = order.customerName ?? 'System'

  if (order.promoCode && manualAmount > 0) {
    const [promo] = await tx
      .select({ id: promotions.id })
      .from(promotions)
      .where(
        sql`UPPER(${promotions.promoCode}) = ${order.promoCode.toUpperCase()} AND ${promotions.type} = 'promocode'`,
      )
      .orderBy(asc(promotions.id))
      .limit(1)
    if (promo) {
      const usage = await recordPromotionUsageInternal(
        {
          promotionId: promo.id,
          orderReference: order.orderNumber,
          orderAmount: total,
          discountAmount: manualAmount,
        },
        client,
      )
      if (!usage.counted && strict) throw new Error('promo-limit')
      await tx.insert(orderHistory).values({
        orderId: order.orderId,
        type: 'note',
        message: usage.counted
          ? `Промокод ${order.promoCode} — ${manualAmount.toFixed(2)} ₴`
          : `Промокод ${order.promoCode} — не засчитан: лимит исчерпан`,
        actor,
      })
    }
  }

  if (order.autoDiscountId && autoAmount > 0) {
    const usage = await recordPromotionUsageInternal(
      {
        promotionId: Number(order.autoDiscountId),
        orderReference: order.orderNumber,
        orderAmount: total,
        discountAmount: autoAmount,
      },
      client,
    )
    if (!usage.counted && strict) throw new Error('promo-limit')
    await tx.insert(orderHistory).values({
      orderId: order.orderId,
      type: 'note',
      message: usage.counted
        ? `Автознижка — ${autoAmount.toFixed(2)} ₴`
        : `Автознижка — не засчитана: лимит исчерпан`,
      actor,
    })
  }
}

/**
 * Releases promo usage recorded for an order: deletes its ledger rows and
 * reverses the promotion counters (usedCount, totals), floored at zero so a
 * retry can never drive them negative.
 *
 * Called on order cancel and on FULL refund — the sale is voided, so the
 * promo-code slot is freed for reuse. Partial refunds keep the usage: the
 * order is still active with the discount applied.
 *
 * Idempotent: with no ledger rows for the order reference it is a no-op, so
 * cancel→refund or double-cancel sequences can't double-decrement.
 */
export async function releasePromotionUsageForOrder(
  orderReference: string,
  client?: PoolClient,
): Promise<{ released: Array<{ promotionId: number; promoCode: string | null }> }> {
  const tx = client ? dbForClient(client) : db
  const rows = await tx
    .delete(promotionUsages)
    .where(eq(promotionUsages.orderReference, orderReference))
    .returning({
      promotionId: promotionUsages.promotionId,
      orderAmount: promotionUsages.orderAmount,
      discountAmount: promotionUsages.discountAmount,
    })
  if (rows.length === 0) return { released: [] }

  const released: Array<{ promotionId: number; promoCode: string | null }> = []
  for (const row of rows) {
    const [promo] = await tx
      .update(promotions)
      .set({
        usedCount: sql`GREATEST(${promotions.usedCount} - 1, 0)`,
        totalOrdersAmount: sql`GREATEST(${promotions.totalOrdersAmount} - ${row.orderAmount}::numeric, 0)`,
        totalDiscountAmount: sql`GREATEST(${promotions.totalDiscountAmount} - ${row.discountAmount}::numeric, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(promotions.id, row.promotionId))
      .returning({ promoCode: promotions.promoCode })
    released.push({ promotionId: row.promotionId, promoCode: promo?.promoCode ?? null })
  }

  revalidatePath('/admin/promotions')
  return { released }
}
