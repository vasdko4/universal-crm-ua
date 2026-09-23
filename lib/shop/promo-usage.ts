import { db, dbForClient } from '@/lib/db'
import { promotions, promotionUsages } from '@/lib/db/schema'
import { and, eq, sql } from 'drizzle-orm'
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
