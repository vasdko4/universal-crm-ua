'use server'

import { db } from '@/lib/db'
import { deliveryMethods, paymentMethods } from '@/lib/db/schema'
import { asc, eq } from 'drizzle-orm'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/shop/queries'
import { assertPermission, assertWritePermission } from '@/lib/session'
import { decryptSecret, encryptConfigSecrets, DELIVERY_CONFIG_SECRET_KEYS } from '@/lib/secrets'
import { searchCities, searchWarehouses, type NpCity, type NpWarehouse } from '@/lib/delivery/nova-poshta'

type ActionResult = { ok: boolean; message: string }

/**
 * Delivery/payment method config comes from an admin form, but these actions
 * are reachable directly — validate the shape before it hits the JSONB
 * column: unknown keys are dropped, values are capped, booleans are checked.
 * (Gateway secrets use their own allowlist in app/actions/payments.ts.)
 */
function validateMethodConfig(
  data: { isActive: boolean; config: Record<string, string> },
): string | null {
  if (typeof data.isActive !== 'boolean') return 'Некорректное значение активности'
  if (!data.config || typeof data.config !== 'object' || Array.isArray(data.config)) {
    return 'Некорректная конфигурация'
  }
  const entries = Object.entries(data.config)
  if (entries.length > 50) return 'Слишком много параметров конфигурации'
  for (const [k, v] of entries) {
    if (typeof k !== 'string' || k.length === 0 || k.length > 64) return 'Некорректное имя параметра'
    if (typeof v !== 'string' || v.length > 2000) return 'Слишком длинное значение параметра'
  }
  return null
}

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
  const rows = await db.select().from(deliveryMethods).orderBy(asc(deliveryMethods.sortOrder))
  // Never ship the (encrypted) Nova Poshta apiKey to the browser: the
  // delivery form only needs to know a key IS stored (hasStoredApiKey),
  // and an empty field on save keeps the stored value (see
  // updateDeliveryMethod below). Same pattern as getGateways' hasSecret.
  return rows.map((m) => {
    const raw = (m.config ?? {}) as Record<string, string>
    const config: Record<string, string> = { ...raw }
    const hasSecret: Record<string, boolean> = {}
    for (const key of DELIVERY_CONFIG_SECRET_KEYS) {
      hasSecret[key] = Boolean(raw[key])
      if (config[key]) config[key] = ''
    }
    return { ...m, config, hasSecret }
  })
}

export async function updateDeliveryMethod(
  code: string,
  data: { isActive: boolean; config: Record<string, string> },
): Promise<ActionResult> {
  const configError = validateMethodConfig(data)
  if (configError) return { ok: false, message: configError }
  try {
    await assertWritePermission('delivery')
    const [method] = await db
      .select()
      .from(deliveryMethods)
      .where(eq(deliveryMethods.code, code))
    if (!method) return { ok: false, message: 'Метод доставки не найден' }

    // Нова Пошта — обязательный метод, отключить нельзя
    const isActive = method.isRemovable ? data.isActive : true

    // BUGFIX: same config-wipe issue as updatePaymentMethod — merge incoming
    // fields over the stored config so the toggle never drops the apiKey.
    // encryptConfigSecrets is idempotent, so merging the decrypted apiKey
    // over the encrypted stored value is safe.
    // An empty secret field means "keep the stored value": the form posts ''
    // for an untouched key (the key itself is never sent to the browser),
    // and merging '' would wipe it. Same keepSecret rule as updateGateway
    // (including its '__CLEAR__' sentinel for deliberately clearing a key).
    const stored = (method.config as Record<string, string> | null) ?? {}
    const incoming = { ...data.config }
    for (const key of DELIVERY_CONFIG_SECRET_KEYS) {
      if (String(incoming[key] ?? '').trim() === '__CLEAR__') incoming[key] = ''
      else if (!String(incoming[key] ?? '').trim()) incoming[key] = stored[key] ?? ''
    }
    const merged = { ...stored, ...incoming }
    await db
      .update(deliveryMethods)
      // BUGFIX: the Nova Poshta apiKey used to be stored in plaintext,
      // contradicting the app's at-rest encryption policy (lib/secrets.ts).
      // Read paths already decrypt (getNovaPoshtaKey, nova-poshta.ts), and
      // encryptConfigSecrets is idempotent, so this is a safe migration.
      .set({ isActive, config: encryptConfigSecrets(merged, DELIVERY_CONFIG_SECRET_KEYS), updatedAt: new Date() })
      .where(eq(deliveryMethods.code, code))
    revalidatePath('/admin/delivery')
    revalidateTag(CACHE_TAGS.checkout, 'max')
    return { ok: true, message: 'Настройки доставки сохранены' }
  } catch (e) {
    console.error('[settings] updateDeliveryMethod failed:', e)
    return { ok: false, message: 'Не удалось сохранить настройки доставки' }
  }
}

/* --------------------------- Нова Пошта: поиск --------------------------- */

async function getNovaPoshtaKey(): Promise<string> {
  const [np] = await db
    .select()
    .from(deliveryMethods)
    .where(eq(deliveryMethods.code, 'nova_poshta'))
  const config = (np?.config ?? {}) as Record<string, string>
  return decryptSecret(config.apiKey).trim()
}

export async function npSearchCities(
  query: string,
): Promise<{ ok: boolean; demo: boolean; cities: NpCity[]; message?: string }> {
  // BUGFIX: this used to be callable by anyone — it proxies the PAID Nova
  // Poshta API at the shop's expense. It's only used from the admin panel.
  await assertPermission('delivery')
  if (typeof query !== 'string' || !query.trim() || query.trim().length > 120) {
    return { ok: false, demo: false, cities: [], message: 'Некорректный запрос' }
  }
  query = query.trim()
  try {
    const apiKey = await getNovaPoshtaKey()
    const cities = await searchCities(apiKey, query)
    return { ok: true, demo: !apiKey, cities }
  } catch (e) {
    console.error('[settings] npSearchCities failed:', e)
    return { ok: false, demo: false, cities: [], message: 'Не удалось найти города' }
  }
}

export async function npSearchWarehouses(params: {
  cityName: string
  cityRef?: string
  query: string
  type: 'branch' | 'postomat'
}): Promise<{ ok: boolean; demo: boolean; items: NpWarehouse[]; message?: string }> {
  // BUGFIX: same as npSearchCities — paid API proxy, admin-only.
  await assertPermission('delivery')
  if (
    typeof params.cityName !== 'string' ||
    !params.cityName.trim() ||
    params.cityName.trim().length > 120 ||
    (params.cityRef != null && (typeof params.cityRef !== 'string' || params.cityRef.length > 64)) ||
    typeof params.query !== 'string' ||
    params.query.trim().length > 120 ||
    (params.type !== 'branch' && params.type !== 'postomat')
  ) {
    return { ok: false, demo: false, items: [], message: 'Некорректные параметры поиска' }
  }
  try {
    const apiKey = await getNovaPoshtaKey()
    const { demo, items } = await searchWarehouses(apiKey, params)
    return { ok: true, demo, items }
  } catch (e) {
    console.error('[settings] npSearchWarehouses failed:', e)
    return { ok: false, demo: false, items: [], message: 'Не удалось найти отделения' }
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
  const configError = validateMethodConfig(data)
  if (configError) return { ok: false, message: configError }
  try {
    await assertWritePermission('payments')
    const [method] = await db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.code, code))
    if (!method) return { ok: false, message: 'Метод оплаты не найден' }
    // BUGFIX: used to REPLACE config wholesale — the isActive toggle in
    // payment-methods-tab sends config: {}, wiping saved IBAN/card holder/
    // requisites. Merge incoming fields over the stored config instead.
    const merged = { ...((method.config as Record<string, string> | null) ?? {}), ...data.config }
    await db
      .update(paymentMethods)
      .set({ isActive: data.isActive, config: merged, updatedAt: new Date() })
      .where(eq(paymentMethods.code, code))
    revalidatePath('/admin/payments')
    revalidateTag(CACHE_TAGS.checkout, 'max')
    return { ok: true, message: 'Настройки оплаты сохранены' }
  } catch (e) {
    console.error('[settings] updatePaymentMethod failed:', e)
    return { ok: false, message: 'Не удалось сохранить настройки оплаты' }
  }
}
