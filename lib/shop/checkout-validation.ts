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
} as const

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type SanitizedCheckout = {
  firstName: string
  lastName: string | null
  phone: string
  email: string | null
  deliveryMethod: string
  deliveryCity: string | null
  deliveryCityRef: string | null
  deliveryBranch: string | null
  deliveryAddress: string | null
  paymentMethod: string
  note: string | null
  promoCode: string | null
  cartToken: string | null
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
function toIntInRange(v: unknown, min: number, max: number): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : Number.NaN
  if (!Number.isFinite(n)) return null
  const i = Math.floor(n)
  if (i < min || i > max) return null
  return i
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
  if (email && !EMAIL_RE.test(email)) {
    return { ok: false, error: t.invalidEmail }
  }

  // --- delivery / payment ---
  const deliveryMethod = cap(input.deliveryMethod, L.deliveryMethod)
  if (!deliveryMethod) return { ok: false, error: t.deliveryMethodRequired }
  const paymentMethod = cap(input.paymentMethod, L.paymentMethod)
  if (!paymentMethod) return { ok: false, error: t.paymentMethodRequired }

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
      deliveryAddress: cap(input.deliveryAddress, L.address),
      paymentMethod,
      note: cap(input.note, L.note),
      promoCode: cap(input.promoCode, L.promoCode),
      // Same shape the abandoned-cart writer accepts; junk tokens are dropped.
      cartToken: cartTokenRaw && /^[a-z0-9-]{16,64}$/i.test(cartTokenRaw) ? cartTokenRaw : null,
      items,
    },
  }
}
