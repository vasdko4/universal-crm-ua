'use server'

import { db } from '@/lib/db'
import { deliveryMethods, paymentMethods } from '@/lib/db/schema'
import { asc, eq } from 'drizzle-orm'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/shop/queries'
import { assertPermission } from '@/lib/session'
import { searchCities, searchWarehouses, type NpCity, type NpWarehouse } from '@/lib/delivery/nova-poshta'

type ActionResult = { ok: boolean; message: string }

/* ------------------------------ Методы доставки ------------------------------ */

// SECURITY: was missing any permission check even though it returns the full
// `config` column, including the live Nova Poshta apiKey. As a server action
// it's reachable directly regardless of the admin page-level route guard, so
// any logged-in admin-center user — regardless of role — could read that key
// without the delivery permission. (The public storefront checkout uses the
// separate getActiveDeliveryMethods() in lib/shop/queries.ts, which is
// intentionally unauthenticated but must never forward `config` to the
// client — see app/(shop)/checkout/page.tsx.)
export async function getDeliveryMethods() {
  await assertPermission('delivery')
  return db.select().from(deliveryMethods).orderBy(asc(deliveryMethods.sortOrder))
}

export async function updateDeliveryMethod(
  code: string,
  data: { isActive: boolean; config: Record<string, string> },
): Promise<ActionResult> {
  try {
    await assertPermission('delivery')
    const [method] = await db
      .select()
      .from(deliveryMethods)
      .where(eq(deliveryMethods.code, code))
    if (!method) return { ok: false, message: 'Метод доставки не найден' }

    // Нова Пошта — обязательный метод, отключить нельзя
    const isActive = method.isRemovable ? data.isActive : true

    await db
      .update(deliveryMethods)
      .set({ isActive, config: data.config, updatedAt: new Date() })
      .where(eq(deliveryMethods.code, code))
    revalidatePath('/admin/delivery')
    revalidateTag(CACHE_TAGS.checkout, 'max')
    return { ok: true, message: 'Настройки доставки сохранены' }
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }
}

/* --------------------------- Нова Пошта: поиск --------------------------- */

async function getNovaPoshtaKey(): Promise<string> {
  const [np] = await db
    .select()
    .from(deliveryMethods)
    .where(eq(deliveryMethods.code, 'nova_poshta'))
  const config = (np?.config ?? {}) as Record<string, string>
  return (config.apiKey ?? '').trim()
}

export async function npSearchCities(
  query: string,
): Promise<{ ok: boolean; demo: boolean; cities: NpCity[]; message?: string }> {
  try {
    const apiKey = await getNovaPoshtaKey()
    const cities = await searchCities(apiKey, query)
    return { ok: true, demo: !apiKey, cities }
  } catch (e) {
    return { ok: false, demo: false, cities: [], message: (e as Error).message }
  }
}

export async function npSearchWarehouses(params: {
  cityName: string
  cityRef?: string
  query: string
  type: 'branch' | 'postomat'
}): Promise<{ ok: boolean; demo: boolean; items: NpWarehouse[]; message?: string }> {
  try {
    const apiKey = await getNovaPoshtaKey()
    const { demo, items } = await searchWarehouses(apiKey, params)
    return { ok: true, demo, items }
  } catch (e) {
    return { ok: false, demo: false, items: [], message: (e as Error).message }
  }
}

/* ------------------------------- Методы оплаты ------------------------------- */

// SECURITY: same gap as getDeliveryMethods() above — was missing a
// permission check despite returning `config` (bank IBAN/EDRPOU for the
// "pay by requisites" method). Fixed the same way.
export async function getPaymentMethods() {
  await assertPermission('payments')
  return db.select().from(paymentMethods).orderBy(asc(paymentMethods.sortOrder))
}

export async function updatePaymentMethod(
  code: string,
  data: { isActive: boolean; config: Record<string, string> },
): Promise<ActionResult> {
  try {
    await assertPermission('payments')
    await db
      .update(paymentMethods)
      .set({ isActive: data.isActive, config: data.config, updatedAt: new Date() })
      .where(eq(paymentMethods.code, code))
    revalidatePath('/admin/payments')
    revalidateTag(CACHE_TAGS.checkout, 'max')
    return { ok: true, message: 'Настройки оплаты сохранены' }
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }
}
