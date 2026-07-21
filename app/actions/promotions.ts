'use server'

import { db } from '@/lib/db'
import { promotions, promotionUsages, productGroups, productGroupItems, products } from '@/lib/db/schema'
import { and, asc, count, desc, eq, ilike, inArray, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { assertPermission } from '@/lib/session'

export type PromotionInput = {
  type: 'promocode' | 'discount'
  name: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  promoCode?: string | null
  targetType: 'all' | 'groups' | 'products'
  targetGroupIds?: number[]
  targetProductIds?: number[]
  usageLimit?: number | null
  minOrderAmount?: number | null
  noStacking?: boolean
  excludeWholesale?: boolean
  startsAt: string
  endsAt?: string | null
  isActive?: boolean
}

export type PromotionListParams = {
  search?: string
  status?: 'all' | 'active' | 'inactive'
  page?: number
  pageSize?: number
}

function validate(input: PromotionInput): string | null {
  if (!input.name?.trim()) return 'Название акции обязательно'
  if (!(input.discountValue > 0)) return 'Размер скидки должен быть больше нуля'
  if (input.discountType === 'percentage' && input.discountValue > 100) {
    return 'Процент скидки не может превышать 100%'
  }
  if (input.type === 'promocode' && !input.promoCode?.trim()) {
    return 'Для акции типа «Промокод» нужно указать код'
  }
  if (input.targetType === 'groups' && !(input.targetGroupIds && input.targetGroupIds.length)) {
    return 'Выберите хотя бы одну группу товаров'
  }
  if (input.targetType === 'products' && !(input.targetProductIds && input.targetProductIds.length)) {
    return 'Выберите хотя бы одну позицию'
  }
  return null
}

export async function generatePromoCode(): Promise<string> {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export async function getPromotions(params: PromotionListParams = {}) {
  await assertPermission('promotions')
  const { search = '', status = 'all', page = 1, pageSize = 8 } = params
  const conditions = []
  if (search.trim()) conditions.push(ilike(promotions.name, `%${search.trim()}%`))
  if (status === 'active') conditions.push(eq(promotions.isActive, true))
  if (status === 'inactive') conditions.push(eq(promotions.isActive, false))
  const where = conditions.length ? and(...conditions) : undefined

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(promotions)
      .where(where)
      .orderBy(desc(promotions.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ value: count() }).from(promotions).where(where),
  ])

  const total = totalRows[0]?.value ?? 0
  return { items: rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
}

export async function getPromotionsCount() {
  await assertPermission('promotions')
  const rows = await db.select({ value: count() }).from(promotions)
  return rows[0]?.value ?? 0
}

export async function getPromotionById(id: number) {
  await assertPermission('promotions')
  const rows = await db.select().from(promotions).where(eq(promotions.id, id)).limit(1)
  return rows[0] ?? null
}

export async function getTargetOptions() {
  await assertPermission('promotions')
  const [groups, prods] = await Promise.all([
    db
      .select({ id: productGroups.id, name: productGroups.nameRu })
      .from(productGroups)
      .orderBy(asc(productGroups.sortOrder), asc(productGroups.id)),
    db
      .select({ id: products.id, name: products.nameRu })
      .from(products)
      .where(sql`${products.deletedAt} IS NULL`)
      .orderBy(asc(products.nameRu))
      .limit(200),
  ])
  return { groups, products: prods }
}

export async function createPromotion(input: PromotionInput) {
  await assertPermission('promotions')
  const error = validate(input)
  if (error) return { success: false, error }

  await db.insert(promotions).values({
    type: input.type,
    name: input.name.trim(),
    discountType: input.discountType,
    discountValue: String(input.discountValue),
    promoCode: input.type === 'promocode' ? input.promoCode?.trim().toUpperCase() || null : null,
    targetType: input.targetType,
    targetGroupIds: input.targetType === 'groups' ? input.targetGroupIds ?? [] : [],
    targetProductIds: input.targetType === 'products' ? input.targetProductIds ?? [] : [],
    usageLimit: input.usageLimit ?? null,
    minOrderAmount: input.minOrderAmount != null ? String(input.minOrderAmount) : null,
    noStacking: input.noStacking ?? false,
    excludeWholesale: input.excludeWholesale ?? false,
    startsAt: new Date(input.startsAt),
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
    isActive: input.isActive ?? true,
  })
  revalidatePath('/admin/promotions')
  return { success: true }
}

export async function updatePromotion(id: number, input: PromotionInput) {
  await assertPermission('promotions')
  const error = validate(input)
  if (error) return { success: false, error }

  await db
    .update(promotions)
    .set({
      type: input.type,
      name: input.name.trim(),
      discountType: input.discountType,
      discountValue: String(input.discountValue),
      promoCode: input.type === 'promocode' ? input.promoCode?.trim().toUpperCase() || null : null,
      targetType: input.targetType,
      targetGroupIds: input.targetType === 'groups' ? input.targetGroupIds ?? [] : [],
      targetProductIds: input.targetType === 'products' ? input.targetProductIds ?? [] : [],
      usageLimit: input.usageLimit ?? null,
      minOrderAmount: input.minOrderAmount != null ? String(input.minOrderAmount) : null,
      noStacking: input.noStacking ?? false,
      excludeWholesale: input.excludeWholesale ?? false,
      startsAt: new Date(input.startsAt),
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      isActive: input.isActive ?? true,
      updatedAt: new Date(),
    })
    .where(eq(promotions.id, id))
  revalidatePath('/admin/promotions')
  return { success: true }
}

export async function togglePromotionActive(id: number, isActive: boolean) {
  await assertPermission('promotions')
  await db.update(promotions).set({ isActive, updatedAt: new Date() }).where(eq(promotions.id, id))
  revalidatePath('/admin/promotions')
  return { success: true }
}

export async function deletePromotion(id: number) {
  await assertPermission('promotions')
  await db.delete(promotionUsages).where(eq(promotionUsages.promotionId, id))
  await db.delete(promotions).where(eq(promotions.id, id))
  revalidatePath('/admin/promotions')
  return { success: true }
}

export type PromoCartLine = { productId: number; price: number; quantity: number }

export type PromoEvaluation =
  | { ok: false; error: string }
  | {
      ok: true
      promotionId: number
      name: string
      code: string
      discountType: 'percentage' | 'fixed'
      discountValue: number
      discount: number
    }

// Core promo-code logic shared by the checkout UI (preview) and order creation
// (authoritative). Never trusts client prices — callers pass DB-derived lines.
export async function evaluatePromoCode(rawCode: string, lines: PromoCartLine[]): Promise<PromoEvaluation> {
  const code = rawCode.trim().toUpperCase()
  if (!code) return { ok: false, error: 'Введите промокод' }
  if (!lines.length) return { ok: false, error: 'Корзина пуста' }

  const [promo] = await db
    .select()
    .from(promotions)
    .where(and(eq(promotions.type, 'promocode'), sql`UPPER(${promotions.promoCode}) = ${code}`))
    .limit(1)

  if (!promo) return { ok: false, error: 'Промокод не найден' }
  if (!promo.isActive) return { ok: false, error: 'Промокод неактивен' }

  const now = new Date()
  if (promo.startsAt && new Date(promo.startsAt) > now) return { ok: false, error: 'Промокод ещё не действует' }
  if (promo.endsAt && new Date(promo.endsAt) < now) return { ok: false, error: 'Срок действия промокода истёк' }
  if (promo.usageLimit != null && promo.usedCount >= promo.usageLimit) {
    return { ok: false, error: 'Лимит использования промокода исчерпан' }
  }

  const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0)
  if (promo.minOrderAmount != null && subtotal < Number(promo.minOrderAmount)) {
    return { ok: false, error: `Минимальная сумма заказа для промокода — ${Number(promo.minOrderAmount)} грн` }
  }

  // Determine which line items the promo applies to.
  let eligibleBase = subtotal
  if (promo.targetType === 'products') {
    const targetIds = new Set((promo.targetProductIds as number[]) ?? [])
    eligibleBase = lines.filter((l) => targetIds.has(l.productId)).reduce((s, l) => s + l.price * l.quantity, 0)
  } else if (promo.targetType === 'groups') {
    const groupIds = (promo.targetGroupIds as number[]) ?? []
    const productIds = lines.map((l) => l.productId)
    const memberRows =
      groupIds.length && productIds.length
        ? await db
            .select({ productId: productGroupItems.productId })
            .from(productGroupItems)
            .where(and(inArray(productGroupItems.groupId, groupIds), inArray(productGroupItems.productId, productIds)))
        : []
    const memberSet = new Set(memberRows.map((r) => r.productId))
    eligibleBase = lines.filter((l) => memberSet.has(l.productId)).reduce((s, l) => s + l.price * l.quantity, 0)
  }

  if (eligibleBase <= 0) {
    return { ok: false, error: 'Промокод не применяется к товарам в корзине' }
  }

  const value = Number(promo.discountValue)
  let discount =
    promo.discountType === 'percentage' ? (eligibleBase * value) / 100 : Math.min(value, eligibleBase)
  discount = Math.min(discount, subtotal)
  discount = Math.round(discount * 100) / 100
  if (discount <= 0) return { ok: false, error: 'Промокод не даёт скидки на этот заказ' }

  return {
    ok: true,
    promotionId: promo.id,
    name: promo.name,
    code,
    discountType: promo.discountType as 'percentage' | 'fixed',
    discountValue: value,
    discount,
  }
}

// Public action used by the checkout UI to preview a promo code against the
// current cart. The discount shown here is a preview; createStorefrontOrder
// re-evaluates with authoritative DB prices when the order is placed.
export async function validatePromoCode(code: string, lines: PromoCartLine[]): Promise<PromoEvaluation> {
  const safeLines = (lines ?? []).map((l) => ({
    productId: l.productId,
    price: Math.max(0, Number(l.price) || 0),
    quantity: Math.max(1, Math.floor(l.quantity)),
  }))
  return evaluatePromoCode(code, safeLines)
}

// Записать факт применения акции к заказу и пересчитать статистику.
//
// evaluatePromoCode's usageLimit check happens earlier (at checkout time, and
// again — much later for online payments — only implicitly), so two
// concurrent orders could both pass that check for a one-time-use code. To
// close that race at the one place it actually matters, the usedCount bump
// is a single conditional UPDATE (only applies while still under the limit),
// wrapped in a transaction with the usage-log insert so the two never
// diverge. If the limit was already reached by a concurrent order, the count
// is not over-incremented; the order itself (already placed, discount
// already applied) is not rolled back — this only prevents the *reported*
// usage/limit stats from drifting past the configured limit.
export async function recordPromotionUsage(input: {
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
