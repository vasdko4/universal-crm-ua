import { db } from '@/lib/db'
import { promotions, promotionUsages } from '@/lib/db/schema'
import { and, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

/**
 * Records that a promotion was applied to an order. Server-only — never
 * export this from a 'use server' file. The public action
 * `recordPromotionUsage` in app/actions/promotions.ts is admin-gated and
 * must not be the path checkout fulfillment uses.
 */
export async function recordPromotionUsageInternal(input: {
  promotionId: number
  orderReference?: string
  orderAmount: number
  discountAmount: number
}) {
  const withinLimit = sql`(${promotions.usageLimit} IS NULL OR ${promotions.usedCount} < ${promotions.usageLimit})`

  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(promotions)
      .set({
        usedCount: sql`${promotions.usedCount} + 1`,
        totalOrdersAmount: sql`${promotions.totalOrdersAmount} + ${input.orderAmount}`,
        totalDiscountAmount: sql`${promotions.totalDiscountAmount} + ${input.discountAmount}`,
        updatedAt: new Date(),
      })
      .where(and(eq(promotions.id, input.promotionId), withinLimit))
      .returning({ id: promotions.id })

    // Still log the usage record even if the limit was already hit by a
    // concurrent order — the order/discount already happened, so admins
    // should be able to see it in the usage history regardless.
    if (!updated) {
      await tx
        .update(promotions)
        .set({
          totalOrdersAmount: sql`${promotions.totalOrdersAmount} + ${input.orderAmount}`,
          totalDiscountAmount: sql`${promotions.totalDiscountAmount} + ${input.discountAmount}`,
          updatedAt: new Date(),
        })
        .where(eq(promotions.id, input.promotionId))
    }

    await tx.insert(promotionUsages).values({
      promotionId: input.promotionId,
      orderReference: input.orderReference ?? null,
      orderAmount: String(input.orderAmount),
      discountAmount: String(input.discountAmount),
    })
  })

  revalidatePath('/admin/promotions')
  return { success: true }
}
