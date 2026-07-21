'use server'

import { db } from '@/lib/db'
import { modalAds } from '@/lib/db/schema'
import { and, count, desc, eq, ilike, lte, or, isNull, gte, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { assertPermission } from '@/lib/session'
import { auditLog } from '@/lib/audit-log'

export type ModalAdTargetPage = 'all' | 'home' | 'catalog' | 'product' | 'cart'
export type ModalAdTrigger = 'delay' | 'scroll' | 'exit'
export type ModalAdFrequency = 'every' | 'session' | 'days'
export type ModalAdSize = 'small' | 'medium' | 'large'

export type ModalAdInput = {
  name: string
  title: string
  body?: string | null
  imageUrl?: string | null
  buttonText?: string | null
  buttonUrl?: string | null
  buttonColor?: string | null
  targetPages: ModalAdTargetPage[]
  triggerType: ModalAdTrigger
  triggerValue: number
  frequency: ModalAdFrequency
  frequencyDays?: number
  size: ModalAdSize
  startsAt: string
  endsAt?: string | null
  isActive?: boolean
}

export type ModalAdListParams = {
  search?: string
  status?: 'all' | 'active' | 'inactive'
  page?: number
  pageSize?: number
}

function validate(input: ModalAdInput): string | null {
  if (!input.name?.trim()) return 'Название кампании обязательно'
  if (!input.title?.trim()) return 'Заголовок баннера обязателен'
  if (!input.targetPages?.length) return 'Выберите хотя бы одну страницу показа'
  if (input.triggerType === 'delay' && !(input.triggerValue >= 0 && input.triggerValue <= 300)) {
    return 'Задержка должна быть от 0 до 300 секунд'
  }
  if (input.triggerType === 'scroll' && !(input.triggerValue >= 1 && input.triggerValue <= 100)) {
    return 'Процент прокрутки должен быть от 1 до 100'
  }
  if (input.frequency === 'days' && !((input.frequencyDays ?? 0) >= 1)) {
    return 'Период повторного показа должен быть минимум 1 день'
  }
  if (input.buttonUrl?.trim() && !input.buttonText?.trim()) {
    return 'Укажите текст кнопки для ссылки'
  }
  if (input.buttonColor?.trim() && !/^#[0-9a-fA-F]{6}$/.test(input.buttonColor.trim())) {
    return 'Цвет кнопки должен быть в формате #RRGGBB'
  }
  return null
}

function toValues(input: ModalAdInput) {
  return {
    name: input.name.trim(),
    title: input.title.trim(),
    body: input.body?.trim() || null,
    imageUrl: input.imageUrl?.trim() || null,
    buttonText: input.buttonText?.trim() || null,
    buttonUrl: input.buttonUrl?.trim() || null,
    buttonColor: input.buttonColor?.trim() || '',
    targetPages: input.targetPages.includes('all') ? ['all'] : input.targetPages,
    triggerType: input.triggerType,
    triggerValue: Math.round(input.triggerValue),
    frequency: input.frequency,
    frequencyDays: Math.max(1, Math.round(input.frequencyDays ?? 7)),
    size: input.size,
    startsAt: new Date(input.startsAt),
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
    isActive: input.isActive ?? true,
  }
}

export async function getModalAds(params: ModalAdListParams = {}) {
  await assertPermission('modal_ads')
  const { search = '', status = 'all', page = 1, pageSize = 8 } = params
  const conditions = []
  if (search.trim()) {
    conditions.push(
      or(ilike(modalAds.name, `%${search.trim()}%`), ilike(modalAds.title, `%${search.trim()}%`)),
    )
  }
  if (status === 'active') conditions.push(eq(modalAds.isActive, true))
  if (status === 'inactive') conditions.push(eq(modalAds.isActive, false))
  const where = conditions.length ? and(...conditions) : undefined

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(modalAds)
      .where(where)
      .orderBy(desc(modalAds.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ value: count() }).from(modalAds).where(where),
  ])

  const total = totalRows[0]?.value ?? 0
  return { items: rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
}

export async function createModalAd(input: ModalAdInput) {
  const user = await assertPermission('modal_ads')
  const error = validate(input)
  if (error) return { success: false, error }
  await db.insert(modalAds).values(toValues(input))
  void auditLog({
    userId: user.id, userName: user.name, userEmail: user.email,
    action: 'create', entity: 'modal_ad',
    details: `Создана кампания «${input.name}»`,
  })
  revalidatePath('/admin/modal-ads')
  return { success: true }
}

export async function updateModalAd(id: number, input: ModalAdInput) {
  const user = await assertPermission('modal_ads')
  const error = validate(input)
  if (error) return { success: false, error }
  await db
    .update(modalAds)
    .set({ ...toValues(input), updatedAt: new Date() })
    .where(eq(modalAds.id, id))
  void auditLog({
    userId: user.id, userName: user.name, userEmail: user.email,
    action: 'update', entity: 'modal_ad', entityId: id,
    details: `Изменена кампания «${input.name}»`,
  })
  revalidatePath('/admin/modal-ads')
  return { success: true }
}

export async function toggleModalAdActive(id: number, isActive: boolean) {
  const user = await assertPermission('modal_ads')
  await db.update(modalAds).set({ isActive, updatedAt: new Date() }).where(eq(modalAds.id, id))
  void auditLog({
    userId: user.id, userName: user.name, userEmail: user.email,
    action: 'toggle', entity: 'modal_ad', entityId: id,
    details: isActive ? 'Кампания включена' : 'Кампания выключена',
  })
  revalidatePath('/admin/modal-ads')
  return { success: true }
}

export async function deleteModalAd(id: number) {
  const user = await assertPermission('modal_ads')
  await db.delete(modalAds).where(eq(modalAds.id, id))
  void auditLog({
    userId: user.id, userName: user.name, userEmail: user.email,
    action: 'delete', entity: 'modal_ad', entityId: id,
    details: 'Кампания удалена',
  })
  revalidatePath('/admin/modal-ads')
  return { success: true }
}

export async function resetModalAdStats(id: number) {
  await assertPermission('modal_ads')
  await db
    .update(modalAds)
    .set({ viewsCount: 0, clicksCount: 0, closesCount: 0, updatedAt: new Date() })
    .where(eq(modalAds.id, id))
  revalidatePath('/admin/modal-ads')
  return { success: true }
}

// ---------------------------------------------------------------------------
// Public (storefront) API — no permission checks, but read-only / rate-safe.
// ---------------------------------------------------------------------------

export type PublicModalAd = {
  id: number
  title: string
  body: string | null
  imageUrl: string | null
  buttonText: string | null
  buttonUrl: string | null
  buttonColor: string
  targetPages: ModalAdTargetPage[]
  triggerType: ModalAdTrigger
  triggerValue: number
  frequency: ModalAdFrequency
  frequencyDays: number
  size: ModalAdSize
}

// Active campaigns within their date window. The client component picks the
// one matching the current page type and applies frequency capping locally.
export async function getActiveModalAds(): Promise<PublicModalAd[]> {
  const now = new Date()
  const rows = await db
    .select()
    .from(modalAds)
    .where(
      and(
        eq(modalAds.isActive, true),
        lte(modalAds.startsAt, now),
        or(isNull(modalAds.endsAt), gte(modalAds.endsAt, now)),
      ),
    )
    .orderBy(desc(modalAds.createdAt))
    .limit(10)

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    imageUrl: r.imageUrl,
    buttonText: r.buttonText,
    buttonUrl: r.buttonUrl,
    buttonColor: r.buttonColor ?? '',
    targetPages: (r.targetPages as ModalAdTargetPage[]) ?? ['all'],
    triggerType: r.triggerType as ModalAdTrigger,
    triggerValue: r.triggerValue,
    frequency: r.frequency as ModalAdFrequency,
    frequencyDays: r.frequencyDays,
    size: r.size as ModalAdSize,
  }))
}

const AD_EVENTS = new Set(['view', 'click', 'close'])

// Storefront analytics: bump the denormalized counter for a campaign.
export async function trackModalAdEvent(id: number, event: 'view' | 'click' | 'close') {
  if (!Number.isInteger(id) || id <= 0 || !AD_EVENTS.has(event)) return { success: false }
  const column =
    event === 'view' ? modalAds.viewsCount : event === 'click' ? modalAds.clicksCount : modalAds.closesCount
  await db
    .update(modalAds)
    .set({ [event === 'view' ? 'viewsCount' : event === 'click' ? 'clicksCount' : 'closesCount']: sql`${column} + 1` })
    .where(eq(modalAds.id, id))
  return { success: true }
}
