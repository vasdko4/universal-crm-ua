// Pure validation for the public storefront checkout (createStorefrontOrder).
//
// SECURITY: createStorefrontOrder is a public, unauthenticated server action —
// reachable directly over the network by anyone, not only through the checkout
// form. Every field must therefore be treated as hostile input:
//   - unbounded strings would let an attacker store megabytes per order
//     (DB bloat + they end up in admin pages and customer emails);
//   - non-integer/NaN quantities previously slipped past the stock check
//     (`p.quantity < NaN` is false) and produced broken "NaN" totals;
//   - an unbounded items[] array turns one request into an arbitrarily large
//     IN(...) query (cheap DoS).
// This module is pure (no DB/session imports) so it is unit-testable.

import type { CheckoutItem, CheckoutInput } from '@/app/actions/shop'
import { getDictionary, fillTemplate } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/i18n/config'
import { looksLikeEmail } from '@/lib/text'
import { toUuid } from '@/lib/shop/one-click'

export const CHECKOUT_DELIVERY_METHODS = ['nova_poshta', 'ukrposhta', 'courier', 'pickup'] as const
export const CHECKOUT_PAYMENT_METHODS = ['online', 'cod', 'prepay', 'cash', 'requisites'] as const
export const CHECKOUT_COD_DELIVERY = ['nova_poshta', 'ukrposhta'] as const

export const CHECKOUT_LIMITS = {
  maxItems: 50,
  maxQuantityPerLine: 999,
  name: 120,
  phoneDigitsMin: 7,
  phoneDigitsMax: 15,
  phone: 32,
  email: 255,
  deliveryMethod: 50,
  paymentMethod: 50,
  city: 120,
  cityRef: 64,
  branch: 300,
  address: 500,
  note: 2000,
  promoCode: 64,
  cartToken: 64,
  idempotencyKey: 64,
} as const

export type SanitizedCheckout = {
  firstName: string
  lastName: string | null
  phone: string
  email: string | null
  deliveryMethod: string
  deliveryCity: string | null
  deliveryCityRef: string | null
  deliveryBranch: string | null
  deliveryWarehouseRef: string | null
  deliveryAddress: string | null
  paymentMethod: string
  note: string | null
  promoCode: string | null
  cartToken: string | null
  /** Client-generated UUID (one per checkout attempt) — retried submits return the existing order. */
  idempotencyKey: string | null
  items: { productId: number; quantity: number; variantId?: number }[]
}

export type CheckoutValidation =
  | { ok: true; value: SanitizedCheckout }
  | { ok: false; error: string }

function cap(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t.slice(0, max) : null
}

/** Positive-integer parser that never lets NaN/Infinity/floats through. */
export function toIntInRange(v: unknown, min: number, max: number): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : Number.NaN
  if (!Number.isFinite(n)) return null
  if (!Number.isInteger(n)) return null
  if (n < min || n > max) return null
  return n
}

export function validateCheckoutInput(input: CheckoutInput, locale: Locale = 'ru'): CheckoutValidation {
  const L = CHECKOUT_LIMITS
  const t = getDictionary(locale).serverErrors

  // --- items ---
  if (!Array.isArray(input?.items) || input.items.length === 0) {
    return { ok: false, error: t.cartEmpty }
  }
  if (input.items.length > L.maxItems) {
    return { ok: false, error: fillTemplate(t.tooManyItems, { max: L.maxItems }) }
  }
  const items: SanitizedCheckout['items'] = []
  for (const raw of input.items as CheckoutItem[]) {
    const productId = toIntInRange(raw?.productId, 1, 2_147_483_647)
    if (productId == null) return { ok: false, error: t.invalidCartItem }
    const quantity = toIntInRange(raw?.quantity, 1, L.maxQuantityPerLine)
    if (quantity == null) return { ok: false, error: t.invalidQuantity }
    const variantId =
      raw?.variantId == null ? undefined : (toIntInRange(raw.variantId, 1, 2_147_483_647) ?? undefined)
    if (raw?.variantId != null && variantId == null) {
      return { ok: false, error: t.invalidVariant }
    }
    items.push(variantId != null ? { productId, quantity, variantId } : { productId, quantity })
  }

  // --- contact ---
  const firstName = cap(input.firstName, L.name)
  if (!firstName) return { ok: false, error: t.nameAndPhoneRequired }
  const lastName = cap(input.lastName, L.name)

  const phoneRaw = cap(input.phone, L.phone)
  const phoneDigits = (phoneRaw ?? '').replace(/\D/g, '')
  if (!phoneRaw || phoneDigits.length < L.phoneDigitsMin || phoneDigits.length > L.phoneDigitsMax) {
    return { ok: false, error: t.invalidPhone }
  }

  const email = cap(input.email, L.email)
  if (email && !looksLikeEmail(email)) {
    return { ok: false, error: t.invalidEmail }
  }

  // --- delivery / payment ---
  const deliveryMethod = cap(input.deliveryMethod, L.deliveryMethod)
  if (!deliveryMethod) return { ok: false, error: t.deliveryMethodRequired }
  if (!(CHECKOUT_DELIVERY_METHODS as readonly string[]).includes(deliveryMethod)) {
    return { ok: false, error: t.invalidDeliveryMethod }
  }
  const paymentMethod = cap(input.paymentMethod, L.paymentMethod)
  if (!paymentMethod) return { ok: false, error: t.paymentMethodRequired }
  if (!(CHECKOUT_PAYMENT_METHODS as readonly string[]).includes(paymentMethod)) {
    return { ok: false, error: t.invalidPaymentMethod }
  }
  // Cash-on-delivery is only offered for branch deliveries (Nova / Ukrposhta).
  if (paymentMethod === 'cod' && !(CHECKOUT_COD_DELIVERY as readonly string[]).includes(deliveryMethod)) {
    return { ok: false, error: t.codRequiresBranchDelivery }
  }

  const cartTokenRaw = cap(input.cartToken, L.cartToken)

  return {
    ok: true,
    value: {
      firstName,
      lastName,
      phone: phoneRaw,
      email,
      deliveryMethod,
      deliveryCity: cap(input.deliveryCity, L.city),
      deliveryCityRef: cap(input.deliveryCityRef, L.cityRef),
      deliveryBranch: cap(input.deliveryBranch, L.branch),
      deliveryWarehouseRef: cap(input.deliveryWarehouseRef, L.cityRef),
      deliveryAddress: cap(input.deliveryAddress, L.address),
      paymentMethod,
      note: cap(input.note, L.note),
      promoCode: cap(input.promoCode, L.promoCode),
      // Same shape the abandoned-cart writer accepts; junk tokens are dropped.
      cartToken: cartTokenRaw && /^[a-z0-9-]{16,64}$/i.test(cartTokenRaw) ? cartTokenRaw : null,
      // Non-UUID keys are dropped (not an error) — older clients send none.
      idempotencyKey: toUuid(cap(input.idempotencyKey, L.idempotencyKey)),
      items,
    },
  }
}

/**
 * Collapse duplicate product/variant lines so stock is checked against the
 * summed quantity, not each row in isolation (FIX-13). Direct action calls
 * can send `[{id:1,qty:5},{id:1,qty:5}]`; the storefront UI already merges.
 */
export function mergeCheckoutItems(
  items: { productId: number; quantity: number; variantId?: number }[],
): { productId: number; quantity: number; variantId?: number }[] {
  const map = new Map<string, { productId: number; quantity: number; variantId?: number }>()
  for (const it of items) {
    const key = it.variantId != null ? `v:${it.variantId}` : `p:${it.productId}`
    const prev = map.get(key)
    if (prev) {
      prev.quantity += it.quantity
      continue
    }
    map.set(
      key,
      it.variantId != null
        ? { productId: it.productId, quantity: it.quantity, variantId: it.variantId }
        : { productId: it.productId, quantity: it.quantity },
    )
  }
  return [...map.values()]
}

// ---------------------------------------------------------------------------
// Admin numeric / string validators (catalog fixes, 3.4.89).
// Limits mirror the columns in lib/db/schema.ts — update both together.
// ---------------------------------------------------------------------------

/** Postgres `integer` (int4) ceiling: quantity, sortOrder, usageLimit. */
export const INT32_MAX = 2_147_483_647
/** `numeric(10,2)` ceiling (exclusive): price, oldPrice, costPrice, dimensions. */
export const MONEY_10_2_MAX = 100_000_000
/** `numeric(10,3)` ceiling (exclusive): weight. */
export const MONEY_10_3_MAX = 10_000_000
/** `numeric(12,2)` ceiling (exclusive): promotion discountValue/minOrderAmount. */
export const MONEY_12_2_MAX = 10_000_000_000

/** Max string lengths, mirroring the varchar columns in lib/db/schema.ts. */
export const ADMIN_MAX_LEN = {
  productName: 255, // products.name_uk / name_ru varchar(255)
  sku: 100, // products.sku, product_variants.sku varchar(100)
  barcode: 100, // products.barcode varchar(100)
  image: 500, // products.image varchar(500)
  metaTitle: 255, // products.meta_title_uk / meta_title_ru varchar(255)
  feedTitle: 150, // products.feed_title_uk / feed_title_ru varchar(150)
  charName: 255, // product_characteristics.name varchar(255)
  promoName: 255, // promotions.name varchar(255)
  promoCode: 80, // promotions.promo_code varchar(80)
  categoryName: 255, // categories.name_uk / name_ru varchar(255)
  groupName: 255, // product_groups.name_uk / name_ru varchar(255)
} as const

/**
 * Parses an admin form value into a finite number. Accepts numbers and
 * numeric strings (comma decimal separator allowed, as typed in the admin
 * UI); returns `null` for NaN, ±Infinity, non-numeric strings and other
 * junk — so the caller can return a clear error instead of letting
 * Postgres 500 on `invalid input syntax` / `numeric field overflow`.
 * Empty string / null / undefined mean "not provided" → also `null`, so
 * callers must check presence before calling this for optional fields.
 */
export function parseAdminNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string') {
    const t = v.trim().replace(',', '.')
    if (t === '') return null
    const n = Number(t)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** True when the value is a finite number inside [min, max). */
export function isAdminNumberInRange(v: unknown, min: number, max: number): boolean {
  const n = parseAdminNumber(v)
  return n != null && n >= min && n < max
}

/** True when the trimmed string exceeds the column's max length. */
export function adminStringTooLong(v: unknown, max: number): boolean {
  return typeof v === 'string' && v.trim().length > max
}
