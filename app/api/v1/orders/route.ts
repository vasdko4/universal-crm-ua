import { NextResponse, type NextRequest } from 'next/server'
import { createStorefrontOrder, type CheckoutInput } from '@/app/actions/shop'
import { ok, fail, readJson } from '@/lib/api/helpers'
import { clientIp, isRateLimited } from '@/lib/api/rate-limit'
import { getActiveDeliveryMethods, getActivePaymentMethods } from '@/lib/shop/queries'
import { normalizeUaPhone } from '@/lib/shop/phone'
import { looksLikeEmail } from '@/lib/text'

export const dynamic = 'force-dynamic'

/**
 * POST /api/v1/orders — public guest checkout for the Android shop app.
 * Thin REST wrapper over createStorefrontOrder (app/actions/shop.ts), the
 * same checkout the website form uses: server-side prices/stock, promo
 * evaluation, totals, idempotency, fulfillment and payment routing all live
 * there — nothing is reimplemented here.
 *
 * SECURITY:
 * - Only the whitelisted fields below are forwarded to createStorefrontOrder.
 *   Client-sent prices, totals, discounts and delivery costs are dropped —
 *   the server recomputes everything from DB rows.
 * - Delivery/payment method rows carry a `config` column (Nova Poshta
 *   apiKey, bank IBAN/EDRPOU, gateway credentials). Only `.code` is read
 *   here, exactly like GET /api/v1/store does; config never reaches the
 *   client or the logs.
 * - Guest-only: this route never touches the admin createOrder path and
 *   accepts no admin fields.
 * - Rate limit: 5/min per IP (scope 'v1-orders'), matching the website
 *   checkout burst. The stricter inner limits of createStorefrontOrder
 *   (5/min burst + 30/hourly, scopes 'checkout'/'checkout-hourly') still
 *   apply on top, so the effective burst is 5/min.
 */

// Mirrors CHECKOUT_LIMITS (lib/shop/checkout-validation.ts) where the
// website checkout already caps the same fields; quantity is capped
// tighter here (99 vs 999) — a mobile cart line above that is abuse.
const MAX_ITEMS = 50
const MAX_QUANTITY_PER_LINE = 99
const MAX_PRODUCT_ID = 2_147_483_647
const MAX_NAME = 120
const MAX_PHONE = 32
const MAX_EMAIL = 255
const MAX_CITY = 120
const MAX_CITY_REF = 64
const MAX_BRANCH = 300
const MAX_ADDRESS = 500
const MAX_NOTE = 2000
const MAX_PROMO_CODE = 64
const MAX_IDEMPOTENCY_KEY = 64
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const RATE_LIMIT_SCOPE = 'v1-orders'
const RATE_LIMIT_MAX_PER_MIN = 5

type ValidationResult = { ok: true; value: CheckoutInput } | { ok: false; error: string }

function cap(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t.slice(0, max) : null
}

function toPositiveInt(v: unknown, max: number): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : Number.NaN
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > max) return null
  return n
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Structural validation of the API body + mapping onto CheckoutInput.
 * Deep validation (stock, prices, promo, min order, COD rules) stays in
 * createStorefrontOrder — this layer only rejects malformed shapes, unknown
 * methods and un-normalizable phones before any order work starts.
 */
function validateV1OrderBody(
  body: Record<string, unknown>,
  deliveryCodes: Set<string>,
  paymentCodes: Set<string>,
): ValidationResult {
  // --- items ---
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return { ok: false, error: 'Заказ должен содержать хотя бы один товар' }
  }
  if (body.items.length > MAX_ITEMS) {
    return { ok: false, error: `Слишком много позиций в заказе (максимум ${MAX_ITEMS})` }
  }
  const items: CheckoutInput['items'] = []
  for (const raw of body.items as unknown[]) {
    if (!isRecord(raw)) return { ok: false, error: 'Некорректная позиция заказа' }
    const productId = toPositiveInt(raw.productId, MAX_PRODUCT_ID)
    if (productId == null) return { ok: false, error: 'Некорректный товар в заказе' }
    const quantity = toPositiveInt(raw.quantity, MAX_QUANTITY_PER_LINE)
    if (quantity == null) return { ok: false, error: 'Некорректное количество товара' }
    const variantId =
      raw.variantId == null ? undefined : toPositiveInt(raw.variantId, MAX_PRODUCT_ID)
    if (raw.variantId != null && variantId == null) {
      return { ok: false, error: 'Некорректный вариант товара' }
    }
    items.push(
      variantId != null ? { productId, quantity, variantId } : { productId, quantity },
    )
  }

  // --- customer ---
  if (!isRecord(body.customer)) return { ok: false, error: 'Не указаны данные покупателя' }
  const firstName = cap(body.customer.firstName, MAX_NAME)
  if (!firstName) return { ok: false, error: 'Укажите имя и телефон' }
  const lastName = cap(body.customer.lastName, MAX_NAME)
  const phoneRaw = cap(body.customer.phone, MAX_PHONE)
  // UA normalization (same as one-click checkout): anything that is not a
  // plausible Ukrainian number is rejected here, never stored raw.
  const phone = phoneRaw ? normalizeUaPhone(phoneRaw) : null
  if (!phone) return { ok: false, error: 'Некорректный номер телефона' }
  const email = cap(body.customer.email, MAX_EMAIL)
  if (email && !looksLikeEmail(email)) return { ok: false, error: 'Некорректный email' }

  // --- delivery / payment ---
  if (!isRecord(body.delivery)) return { ok: false, error: 'Не указан способ доставки' }
  const deliveryMethod = cap(body.delivery.method, 50)
  if (!deliveryMethod) return { ok: false, error: 'Не указан способ доставки' }
  if (!deliveryCodes.has(deliveryMethod)) {
    return {
      ok: false,
      error: `Неизвестный способ доставки. Допустимые: ${[...deliveryCodes].join(', ') || 'нет'}`,
    }
  }
  if (!isRecord(body.payment)) return { ok: false, error: 'Не указан способ оплаты' }
  const paymentMethod = cap(body.payment.method, 50)
  if (!paymentMethod) return { ok: false, error: 'Не указан способ оплаты' }
  if (!paymentCodes.has(paymentMethod)) {
    return {
      ok: false,
      error: `Неизвестный способ оплаты. Допустимые: ${[...paymentCodes].join(', ') || 'нет'}`,
    }
  }

  const promoCode = cap(body.promoCode, MAX_PROMO_CODE)
  const note = cap(body.note, MAX_NOTE)
  const idempotencyKeyRaw = cap(body.idempotencyKey, MAX_IDEMPOTENCY_KEY)
  // A malformed key is rejected (one-click does the same) instead of being
  // silently dropped — the app would otherwise lose retry protection.
  if (idempotencyKeyRaw != null && !UUID_RE.test(idempotencyKeyRaw)) {
    return { ok: false, error: 'Некорректный idempotencyKey' }
  }

  const deliveryCity = cap(body.delivery.city, MAX_CITY)
  const deliveryCityRef = cap(body.delivery.cityRef, MAX_CITY_REF)
  const deliveryBranch = cap(body.delivery.branch, MAX_BRANCH)
  const deliveryWarehouseRef = cap(body.delivery.warehouseRef, MAX_CITY_REF)
  const deliveryAddress = cap(body.delivery.address, MAX_ADDRESS)

  // Only whitelisted fields are forwarded. Anything else the client sent
  // (price, total, discount, deliveryCost, ...) is dropped here.
  const input: CheckoutInput = {
    firstName,
    lastName: lastName ?? '',
    phone,
    ...(email ? { email } : {}),
    deliveryMethod,
    ...(deliveryCity ? { deliveryCity } : {}),
    ...(deliveryCityRef ? { deliveryCityRef } : {}),
    ...(deliveryBranch ? { deliveryBranch } : {}),
    ...(deliveryWarehouseRef ? { deliveryWarehouseRef } : {}),
    ...(deliveryAddress ? { deliveryAddress } : {}),
    paymentMethod,
    ...(note ? { note } : {}),
    ...(promoCode ? { promoCode } : {}),
    ...(idempotencyKeyRaw ? { idempotencyKey: idempotencyKeyRaw.toLowerCase() } : {}),
    items,
  }
  return { ok: true, value: input }
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  if (await isRateLimited(RATE_LIMIT_SCOPE, ip, RATE_LIMIT_MAX_PER_MIN)) {
    return fail('Слишком много заказов. Попробуйте позже.', 429)
  }

  const body = await readJson<unknown>(req)
  if (!isRecord(body)) {
    return fail('Некорректный JSON', 400)
  }

  try {
    // Active method codes only — the `config` column of these rows holds
    // gateway credentials and is never read here.
    const [deliveryRows, paymentRows] = await Promise.all([
      getActiveDeliveryMethods(),
      getActivePaymentMethods(),
    ])
    const deliveryCodes = new Set(deliveryRows.map((m) => m.code))
    const paymentCodes = new Set(paymentRows.map((m) => m.code))

    const validated = validateV1OrderBody(body, deliveryCodes, paymentCodes)
    if (!validated.ok) return fail(validated.error, 400)

    const result = await createStorefrontOrder(validated.value)
    if (result.success) {
      const { orderId, orderNumber, total, itemsTotal, discount, promoCode, paymentMethod, paymentUrl, requisites } =
        result
      return ok({
        orderId,
        orderNumber,
        total,
        itemsTotal,
        discount,
        ...(promoCode ? { promoCode } : {}),
        paymentMethod,
        ...(paymentUrl ? { paymentUrl } : {}),
        ...(requisites ? { requisites } : {}),
      })
    }
    if ('retryable' in result) {
      // The first request with this idempotency key is still creating the
      // gateway invoice — the app should retry the same key, not place a
      // second order.
      return NextResponse.json(
        {
          success: false,
          error: 'Заказ уже создаётся, повторите запрос с тем же ключом идемпотентности',
          retryable: true,
          orderNumber: result.orderNumber,
        },
        { status: 409 },
      )
    }
    // Known validation/business failure from the checkout itself (stock,
    // promo, min order, method disabled since the check above, ...).
    return fail(result.error, 400)
  } catch (e) {
    console.error('[api/v1/orders] unexpected:', (e as Error).message)
    return fail('Не удалось создать заказ', 500)
  }
}
