'use server'

import { db } from '@/lib/db'
import { productReviews, productQuestions, products } from '@/lib/db/schema'
import { and, count, desc, eq, inArray } from 'drizzle-orm'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/shop/queries'
import { assertPermission } from '@/lib/session'

type Status = 'pending' | 'approved' | 'rejected'

/* ---------- Reviews ---------- */

export type ReviewListParams = {
  status?: 'all' | Status
  page?: number
  pageSize?: number
}

async function attachProductNames<T extends { productId: number }>(rows: T[]) {
  const ids = [...new Set(rows.map((r) => r.productId))]
  if (!ids.length) return rows.map((r) => ({ ...r, productName: null as string | null }))
  const prods = await db
    .select({ id: products.id, name: products.nameRu })
    .from(products)
    .where(inArray(products.id, ids))
  const map = new Map(prods.map((p) => [p.id, p.name]))
  return rows.map((r) => ({ ...r, productName: map.get(r.productId) ?? null }))
}

export async function getReviews(params: ReviewListParams = {}) {
  await assertPermission('reviews')
  const { status = 'all', page = 1, pageSize = 10 } = params
  const where = status !== 'all' ? eq(productReviews.status, status) : undefined
  const [rows, totalRows] = await Promise.all([
    db.select().from(productReviews).where(where).orderBy(desc(productReviews.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ value: count() }).from(productReviews).where(where),
  ])
  const items = await attachProductNames(rows)
  const total = totalRows[0]?.value ?? 0
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
}

// Public, unauthenticated surface for /api/reviews (storefront/external
// consumers): always approved-only and never includes the reviewer's email.
// Deliberately separate from getReviews() above (which now requires the
// 'reviews' permission) instead of that function forcing safe defaults
// itself, so a direct call to the admin action can never accidentally leak
// pending/rejected reviews or emails regardless of what a caller requests.
export async function getPublicApprovedReviews(params: { page?: number; pageSize?: number } = {}) {
  const { page = 1, pageSize = 10 } = params
  const where = eq(productReviews.status, 'approved')
  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: productReviews.id,
        productId: productReviews.productId,
        authorName: productReviews.authorName,
        rating: productReviews.rating,
        title: productReviews.title,
        body: productReviews.body,
        pros: productReviews.pros,
        cons: productReviews.cons,
        adminReply: productReviews.adminReply,
        createdAt: productReviews.createdAt,
      })
      .from(productReviews)
      .where(where)
      .orderBy(desc(productReviews.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ value: count() }).from(productReviews).where(where),
  ])
  const items = await attachProductNames(rows)
  const total = totalRows[0]?.value ?? 0
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
}

export async function getReviewsStats() {
  await assertPermission('reviews')
  const rows = await db
    .select({ status: productReviews.status, value: count() })
    .from(productReviews)
    .groupBy(productReviews.status)
  const map = Object.fromEntries(rows.map((r) => [r.status, r.value]))
  return {
    total: rows.reduce((s, r) => s + r.value, 0),
    pending: map['pending'] ?? 0,
    approved: map['approved'] ?? 0,
    rejected: map['rejected'] ?? 0,
  }
}

export async function createReview(input: {
  productId: number
  authorName: string
  authorEmail?: string
  rating: number
  title?: string
  body: string
  pros?: string
  cons?: string
}) {
  if (!input.productId) return { success: false, error: 'Не указан товар' }
  if (!input.authorName?.trim()) return { success: false, error: 'Имя обязательно' }
  if (!input.body?.trim()) return { success: false, error: 'Текст отзыва обязателен' }
  const rating = Math.min(5, Math.max(1, Math.round(input.rating || 5)))
  await db.insert(productReviews).values({
    productId: input.productId,
    authorName: input.authorName.trim(),
    authorEmail: input.authorEmail?.trim() || null,
    rating,
    title: input.title?.trim() || null,
    body: input.body.trim(),
    pros: input.pros?.trim() || null,
    cons: input.cons?.trim() || null,
    status: 'pending',
  })
  revalidatePath('/admin/reviews')
  return { success: true }
}

export async function setReviewStatus(id: number, status: Status) {
  await assertPermission('reviews')
  await db.update(productReviews).set({ status, updatedAt: new Date() }).where(eq(productReviews.id, id))
  revalidatePath('/admin/reviews')
  revalidateTag(CACHE_TAGS.reviews, 'max')
  return { success: true }
}

export async function replyToReview(id: number, reply: string) {
  await assertPermission('reviews')
  await db.update(productReviews).set({ adminReply: reply, updatedAt: new Date() }).where(eq(productReviews.id, id))
  revalidatePath('/admin/reviews')
  revalidateTag(CACHE_TAGS.reviews, 'max')
  return { success: true }
}

export async function deleteReview(id: number) {
  await assertPermission('reviews')
  await db.delete(productReviews).where(eq(productReviews.id, id))
  revalidatePath('/admin/reviews')
  revalidateTag(CACHE_TAGS.reviews, 'max')
  return { success: true }
}

/* ---------- Questions ---------- */

export type QuestionListParams = {
  status?: 'all' | 'pending' | 'answered'
  page?: number
  pageSize?: number
}

export async function getQuestions(params: QuestionListParams = {}) {
  await assertPermission('reviews')
  const { status = 'all', page = 1, pageSize = 10 } = params
  const where = status !== 'all' ? eq(productQuestions.status, status) : undefined
  const [rows, totalRows] = await Promise.all([
    db.select().from(productQuestions).where(where).orderBy(desc(productQuestions.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ value: count() }).from(productQuestions).where(where),
  ])
  const items = await attachProductNames(rows)
  const total = totalRows[0]?.value ?? 0
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
}

// Public, unauthenticated surface for /api/questions — always answered-only
// and never includes the asker's email. See getPublicApprovedReviews above
// for why this is a separate function rather than a safe default baked into
// the now permission-gated getQuestions().
export async function getPublicAnsweredQuestions(params: { page?: number; pageSize?: number } = {}) {
  const { page = 1, pageSize = 10 } = params
  const where = eq(productQuestions.status, 'answered')
  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: productQuestions.id,
        productId: productQuestions.productId,
        authorName: productQuestions.authorName,
        question: productQuestions.question,
        answer: productQuestions.answer,
        answeredAt: productQuestions.answeredAt,
        createdAt: productQuestions.createdAt,
      })
      .from(productQuestions)
      .where(where)
      .orderBy(desc(productQuestions.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ value: count() }).from(productQuestions).where(where),
  ])
  const items = await attachProductNames(rows)
  const total = totalRows[0]?.value ?? 0
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
}

export async function getQuestionsStats() {
  await assertPermission('reviews')
  const rows = await db
    .select({ status: productQuestions.status, value: count() })
    .from(productQuestions)
    .groupBy(productQuestions.status)
  const map = Object.fromEntries(rows.map((r) => [r.status, r.value]))
  return {
    total: rows.reduce((s, r) => s + r.value, 0),
    pending: map['pending'] ?? 0,
    answered: map['answered'] ?? 0,
  }
}

export async function createQuestion(input: {
  productId: number
  authorName: string
  authorEmail?: string
  question: string
}) {
  if (!input.productId) return { success: false, error: 'Не указан товар' }
  if (!input.authorName?.trim()) return { success: false, error: 'Имя обязательно' }
  if (!input.question?.trim()) return { success: false, error: 'Текст вопроса обязателен' }
  await db.insert(productQuestions).values({
    productId: input.productId,
    authorName: input.authorName.trim(),
    authorEmail: input.authorEmail?.trim() || null,
    question: input.question.trim(),
    status: 'pending',
  })
  revalidatePath('/admin/reviews')
  return { success: true }
}

export async function answerQuestion(id: number, answer: string) {
  await assertPermission('reviews')
  if (!answer.trim()) return { success: false, error: 'Ответ не может быть пустым' }
  await db
    .update(productQuestions)
    .set({ answer: answer.trim(), status: 'answered', answeredAt: new Date(), updatedAt: new Date() })
    .where(eq(productQuestions.id, id))
  revalidatePath('/admin/reviews')
  revalidateTag(CACHE_TAGS.reviews, 'max')
  return { success: true }
}

export async function deleteQuestion(id: number) {
  await assertPermission('reviews')
  await db.delete(productQuestions).where(eq(productQuestions.id, id))
  revalidatePath('/admin/reviews')
  revalidateTag(CACHE_TAGS.reviews, 'max')
  return { success: true }
}
