// Pure helpers for the one-click ("Купити в 1 клік") purchase flow.
//
// Kept pure (no DB/session imports) so the validation, price resolution and
// double-submit guard are unit-testable — the same split used by
// lib/shop/checkout-validation.ts for the regular checkout.

import { getDictionary, fillTemplate } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/i18n/config'
import { normalizeUaPhone } from '@/lib/shop/phone'

export const ONE_CLICK_LIMITS = {
  /** Same cap as the checkout name field. */
  name: 120,
} as const

export type OneClickInput = {
  productId: unknown
  variantId?: unknown
  name: unknown
  phone: unknown
  /** Client-generated UUID (one per modal open) for order idempotency. */
  idempotencyKey?: unknown
}

export type OneClickValidation =
  | { ok: true; value: { productId: number; variantId?: number; name: string; phone: string; idempotencyKey?: string } }
  | { ok: false; error: string }

/** Positive-integer parser that never lets NaN/Infinity/floats through. */
function toInt(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number.NaN
  if (!Number.isInteger(n)) return null
  return n >= 1 && n <= 2_147_483_647 ? n : null
}

/** UUIDv4-shaped string check for the idempotency key. */
function toUuid(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim().toLowerCase()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s) ? s : null
}

/**
 * Validates the one-click form payload. The phone rule is the checkout's own
 * validator — normalizeUaPhone from lib/shop/phone.ts — reused verbatim, so a
 * number accepted by the checkout is accepted here too.
 */
export function validateOneClickInput(input: OneClickInput, locale: Locale = 'ru'): OneClickValidation {
  const t = getDictionary(locale).oneClick
  const s = getDictionary(locale).serverErrors

  const name = typeof input?.name === 'string' ? input.name.trim().slice(0, ONE_CLICK_LIMITS.name) : ''
  if (!name) return { ok: false, error: t.invalidName }

  const phone = normalizeUaPhone(typeof input?.phone === 'string' ? input.phone : '')
  if (!phone) return { ok: false, error: t.invalidPhone }

  const productId = toInt(input?.productId)
  if (productId == null) return { ok: false, error: s.invalidVariant }

  const variantId =
    input?.variantId == null ? undefined : (toInt(input.variantId) ?? undefined)
  if (input?.variantId != null && variantId == null) {
    return { ok: false, error: s.invalidVariant }
  }

  // Idempotency key is optional (old clients don't send it); when present it
  // must be a well-formed UUID, otherwise the request is rejected.
  let idempotencyKey: string | undefined
  if (input?.idempotencyKey != null) {
    const k = toUuid(input.idempotencyKey)
    if (k == null) return { ok: false, error: s.invalidVariant }
    idempotencyKey = k
  }

  return {
    ok: true,
    value: { productId, variantId, name, phone, idempotencyKey },
  }
}

/** DB-shaped row the price resolver accepts (product). */
export type OneClickProductRow = {
  id: number
  name: string
  price: string | number | null
  costPrice?: string | number | null
  sku?: string | null
  image?: string | null
  quantity: number
  inStock: boolean
  variantsEnabled: boolean
}

/** DB-shaped row the price resolver accepts (variant). */
export type OneClickVariantRow = {
  id: number
  productId: number
  price: string | number | null
  quantity: number
  isInStock: boolean
  sku?: string | null
  image?: string | null
  options?: Record<string, unknown> | null
}

export type OneClickLine = {
  productId: number
  variantId: number | null
  variantLabel: string | null
  name: string
  sku: string | null
  image: string | null
  /** Authoritative unit price, always recomputed from the DB rows. */
  price: number
  costPrice: number | null
  quantity: 1
}

function variantLabel(options: Record<string, unknown> | null | undefined): string | null {
  if (!options) return null
  const label = Object.entries(options)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' / ')
  return label || null
}

/**
 * Recomputes the one-click line item from authoritative DB rows — the server
 * action never trusts the client for the price. Mirrors the product/variant
 * price logic of createStorefrontOrder (variant price/stock wins when the
 * product has variants enabled).
 */
export function resolveOneClickLine(
  product: OneClickProductRow,
  variant: OneClickVariantRow | null,
  locale: Locale = 'ru',
): { ok: true; line: OneClickLine } | { ok: false; error: string } {
  const s = getDictionary(locale).serverErrors

  if (variant != null && product.variantsEnabled) {
    if (variant.productId !== product.id) {
      return { ok: false, error: fillTemplate(s.variantUnavailable, { name: product.name }) }
    }
    const label = variantLabel(variant.options)
    if (!variant.isInStock || variant.quantity < 1) {
      return { ok: false, error: fillTemplate(s.variantOutOfStock, { name: product.name, label: label ?? '' }) }
    }
    const price = Number(variant.price)
    if (!Number.isFinite(price) || price <= 0) {
      return { ok: false, error: s.invalidPrice }
    }
    return {
      ok: true,
      line: {
        productId: product.id,
        variantId: variant.id,
        variantLabel: label,
        name: product.name,
        sku: variant.sku ?? product.sku ?? null,
        image: variant.image ?? product.image ?? null,
        price,
        costPrice: product.costPrice != null ? Number(product.costPrice) : null,
        quantity: 1,
      },
    }
  }

  if (!product.inStock || product.quantity < 1) {
    return { ok: false, error: fillTemplate(s.productOutOfStock, { name: product.name }) }
  }
  const price = Number(product.price)
  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, error: s.invalidPrice }
  }
  return {
    ok: true,
    line: {
      productId: product.id,
      variantId: null,
      variantLabel: null,
      name: product.name,
      sku: product.sku ?? null,
      image: product.image ?? null,
      price,
      costPrice: product.costPrice != null ? Number(product.costPrice) : null,
      quantity: 1,
    },
  }
}

/**
 * Double-click guard for the submit button. A repeated click while the first
 * request is still in flight is rejected (start() returns false), so one tap
 * can never create two orders — the client-side half of the idempotency the
 * server enforces with generateUniqueOrderNumber(). Pure (no DOM) so the
 * rule is unit-testable; the component wires the result to the button's
 * `disabled` state.
 */
export function createOneClickGuard() {
  let inFlight = false
  return {
    get inFlight() {
      return inFlight
    },
    /** Returns true when the caller may submit; false when one already is. */
    start(): boolean {
      if (inFlight) return false
      inFlight = true
      return true
    },
    reset() {
      inFlight = false
    },
  }
}
