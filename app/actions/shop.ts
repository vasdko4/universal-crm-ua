'use server'

import { cookies, headers } from 'next/headers'
import { and, desc, eq, inArray, ne, or, sql } from 'drizzle-orm'
import { db, pool } from '@/lib/db'
import {
  orders,
  orderItems,
  orderHistory,
  products,
  productVariants,
  customers,
  productReviews,
  productQuestions,
  payments,
  paymentGateways,
} from '@/lib/db/schema'
import type { VariantOptions } from '@/lib/db/schema'
import { getShopUser } from '@/lib/session'
import {
  wayforpayCreateInvoice,
  wayforpayCheckStatus,
  monobankCreateInvoice,
  monobankCheckStatus,
} from '@/lib/payments/clients'
import { settlePayment } from '@/lib/payments/settle'
import { evaluatePromoCode } from '@/app/actions/promotions'
import { applyOrderFulfillment, finalizePaidOrder } from '@/lib/shop/order-fulfillment'
import { notifyNewOrder } from '@/lib/notifications'
import { generateUniqueOrderNumber } from '@/lib/orders/order-number'
import { isRateLimited } from '@/lib/api/rate-limit'
import { validateCheckoutInput } from '@/lib/shop/checkout-validation'
import { getStoreSettingsInternal } from '@/lib/store-settings'

/** Client IP for server actions (no Request object available — use headers). */
async function actionClientIp(): Promise<string> {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
}

// Reads the utm_attribution cookie written by lib/shop/utm.ts on landing, so
// the order this checkout produces is tagged with whichever campaign link
// the customer most recently clicked — see migrations/009_google_ads_tracking.sql.
async function readUtmAttribution(): Promise<{
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmTerm: string | null
  utmContent: string | null
}> {
  const empty = { utmSource: null, utmMedium: null, utmCampaign: null, utmTerm: null, utmContent: null }
  try {
    const store = await cookies()
    const raw = store.get('utm_attribution')?.value
    if (!raw) return empty
    const parsed = JSON.parse(decodeURIComponent(raw)) as Record<string, string>
    return {
      utmSource: parsed.utmSource?.slice(0, 150) || null,
      utmMedium: parsed.utmMedium?.slice(0, 150) || null,
      utmCampaign: parsed.utmCampaign?.slice(0, 150) || null,
      utmTerm: parsed.utmTerm?.slice(0, 150) || null,
      utmContent: parsed.utmContent?.slice(0, 150) || null,
    }
  } catch {
    return empty
  }
}

function variantLabel(options: VariantOptions): string {
  return Object.entries(options)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' / ')
}

// Public base URL for building gateway callback/return links.
// Prefer the production domain: preview deployments (VERCEL_URL) are behind
// Vercel Deployment Protection, so bank webhooks sent there get an auth page
// instead of our callback endpoint and payments never settle automatically.
function getBaseUrl(): string {
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.V0_RUNTIME_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    ''
  if (!origin) return ''
  return origin.startsWith('http') ? origin : `https://${origin}`
}

// Picks the gateway that should handle an "online" storefront payment: active,
// not in test mode, configured, and one we know how to invoice. Returns null so
// the caller can fall back to the built-in demo payment page.
async function pickLiveGateway() {
  const gws = await db.select().from(paymentGateways).orderBy(paymentGateways.sortOrder)
  for (const g of gws) {
    if (!g.isActive || g.isTestMode) continue
    const cfg = (g.config ?? {}) as Record<string, string>
    if (g.code === 'wayforpay' && cfg.merchantAccount && cfg.merchantSecretKey && cfg.merchantDomainName) {
      return { code: 'wayforpay' as const, config: cfg }
    }
    if (g.code === 'monobank' && cfg.token) {
      return { code: 'monobank' as const, config: cfg }
    }
  }
  return null
}

export type CheckoutItem = { productId: number; quantity: number; variantId?: number }

export type CheckoutInput = {
  firstName: string
  lastName: string
  phone: string
  email?: string
  deliveryMethod: string
  deliveryCity?: string
  deliveryCityRef?: string
  deliveryBranch?: string
  deliveryAddress?: string
  paymentMethod: string
  note?: string
  promoCode?: string
  items: CheckoutItem[]
  /** Abandoned-cart token so a completed order marks the cart as recovered. */
  cartToken?: string
}

export type CheckoutResult =
  | { success: false; error: string }
  | {
      success: true
      orderId: number
      orderNumber: string
      total: number
      itemsTotal: number
      discount: number
      promoCode?: string
      paymentMethod: string
      paymentUrl?: string
      requisites?: string
    }

// Creates a storefront order: validates stock against the DB (never trusts
// client prices), decrements inventory, links the customer + account, records
// history, and prepares payment info depending on the chosen method.
export async function createStorefrontOrder(input: CheckoutInput): Promise<CheckoutResult> {
  // SECURITY: public, unauthenticated server action — rate-limit per IP to
  // stop order-spam floods (every order writes DB rows, upserts a customer and
  // fires admin/customer notifications). Two buckets: burst + sustained.
  const ip = await actionClientIp()
  if (isRateLimited('checkout', ip, 5) || isRateLimited('checkout-hourly', ip, 30, 3_600_000)) {
    return { success: false, error: 'Слишком много заказов подряд. Попробуйте позже.' }
  }

  // Strict validation of hostile input: caps every string, requires a
  // plausible phone/email, rejects NaN / non-integer / oversized quantities
  // (NaN used to slip past the stock check: `p.quantity < NaN` is false) and
  // caps the number of cart lines. See lib/shop/checkout-validation.ts.
  const validated = validateCheckoutInput(input)
  if (!validated.ok) return { success: false, error: validated.error }
  // Sanitized values are already trimmed/capped; null vs undefined is
  // equivalent for every downstream `?.` / `||` use in this function.
  input = validated.value as unknown as CheckoutInput

  // Load real products to compute authoritative prices and check availability.
  const ids = input.items.map((i) => i.productId)
  const rows = await db
    .select({
      id: products.id,
      name: sql<string>`COALESCE(${products.nameRu}, ${products.nameUk})`,
      sku: products.sku,
      price: products.price,
      costPrice: products.costPrice,
      image: products.image,
      quantity: products.quantity,
    })
    .from(products)
    .where(and(inArray(products.id, ids), sql`${products.deletedAt} IS NULL`))

  const byId = new Map(rows.map((r) => [r.id, r]))

  // Load any variants referenced by the cart to validate per-variant stock/price.
  const variantIds = input.items.map((i) => i.variantId).filter((v): v is number => typeof v === 'number')
  const variantRows = variantIds.length
    ? await db.select().from(productVariants).where(inArray(productVariants.id, variantIds))
    : []
  const variantById = new Map(variantRows.map((v) => [v.id, v]))

  const lineItems: {
    productId: number
    variantId: number | null
    variantLabel: string | null
    name: string
    sku: string | null
    image: string | null
    price: number
    costPrice: number | null
    quantity: number
  }[] = []

  for (const it of input.items) {
    const p = byId.get(it.productId)
    if (!p) return { success: false, error: 'Некоторые товары недоступны' }
    const qty = Math.max(1, Math.floor(it.quantity))

    if (it.variantId != null) {
      const v = variantById.get(it.variantId)
      if (!v || v.productId !== p.id) {
        return { success: false, error: `Вариант товара «${p.name}» недоступен` }
      }
      const label = variantLabel((v.options ?? {}) as VariantOptions)
      if (!v.isInStock || v.quantity < qty) {
        return { success: false, error: `Недостаточно товара «${p.name}» (${label}) на складе` }
      }
      lineItems.push({
        productId: p.id,
        variantId: v.id,
        variantLabel: label || null,
        name: p.name,
        sku: v.sku ?? p.sku,
        image: v.image ?? p.image,
        price: Number(v.price),
        costPrice: p.costPrice != null ? Number(p.costPrice) : null,
        quantity: qty,
      })
      continue
    }

    if (p.quantity < qty) {
      return { success: false, error: `Недостаточно товара «${p.name}» на складе` }
    }
    lineItems.push({
      productId: p.id,
      variantId: null,
      variantLabel: null,
      name: p.name,
      sku: p.sku,
      image: p.image,
      price: Number(p.price),
      costPrice: p.costPrice != null ? Number(p.costPrice) : null,
      quantity: qty,
    })
  }

  const itemsTotal = lineItems.reduce((s, i) => s + i.price * i.quantity, 0)

  // Minimum order amount (Настройки → Общие). Checked against the items
  // subtotal before any discount, and re-validated server-side here since the
  // checkout UI's own check is only a convenience — a client could otherwise
  // bypass it entirely.
  const { minOrder } = await getStoreSettingsInternal()
  if (minOrder.enabled && minOrder.amount > 0 && itemsTotal < minOrder.amount) {
    return {
      success: false,
      error: `Минимальная сумма заказа — ${minOrder.amount} грн. Добавьте товаров ещё на ${(minOrder.amount - itemsTotal).toFixed(2)} грн.`,
    }
  }

  // Authoritatively re-evaluate the promo code (never trust a client discount).
  // Only the code + amount are persisted here; usage is recorded at fulfillment.
  let discount = 0
  let appliedPromoCode: string | null = null
  if (input.promoCode?.trim()) {
    const promo = await evaluatePromoCode(
      input.promoCode,
      lineItems.map((i) => ({ productId: i.productId, price: i.price, quantity: i.quantity })),
    )
    if (!promo.ok) return { success: false, error: promo.error }
    discount = promo.discount
    appliedPromoCode = promo.code
  }

  const total = Math.max(0, itemsTotal - discount)
  const itemsCount = lineItems.reduce((s, i) => s + i.quantity, 0)
  const orderNumber = await generateUniqueOrderNumber()
  const shopUser = await getShopUser()
  const customerName = `${input.firstName.trim()} ${input.lastName?.trim() ?? ''}`.trim()

  // Upsert a customer record by phone.
  let customerId: number | undefined
  const [existingCustomer] = await db
    .select()
    .from(customers)
    .where(eq(customers.phone, input.phone.trim()))
    .limit(1)
  if (existingCustomer) {
    customerId = existingCustomer.id
  } else {
    const [c] = await db
      .insert(customers)
      .values({
        firstName: input.firstName.trim(),
        lastName: input.lastName?.trim() || null,
        phone: input.phone.trim(),
        email: input.email?.trim() || null,
      })
      .returning()
    customerId = c.id
  }

  // Online-gateway orders start as "pending_payment": they are not finalized
  // (no stock/promo side effects, hidden from the customer's order list) until
  // the payment is confirmed. Cash/requisite orders are placed immediately.
  const isOnline = input.paymentMethod === 'online'
  const utm = await readUtmAttribution()

  const [order] = await db
    .insert(orders)
    .values({
      orderNumber,
      status: isOnline ? 'pending_payment' : 'new',
      ...utm,
      customerId,
      customerName,
      customerPhone: input.phone.trim(),
      customerEmail: input.email?.trim() || null,
      deliveryMethod: input.deliveryMethod,
      deliveryCity: input.deliveryCity || null,
      deliveryBranch: input.deliveryBranch || null,
      deliveryAddress: input.deliveryAddress || null,
      paymentMethod: input.paymentMethod,
      paymentStatus: 'unpaid',
      itemsTotal: itemsTotal.toFixed(2),
      deliveryCost: '0',
      discountTotal: discount.toFixed(2),
      promoCode: appliedPromoCode,
      total: total.toFixed(2),
      itemsCount,
      note: input.note || null,
      createdBy: shopUser ? shopUser.id : null,
      userId: shopUser ? shopUser.id : null,
    })
    .returning()

  await db.insert(orderItems).values(
    lineItems.map((i) => ({
      orderId: order.id,
      productId: i.productId,
      variantId: i.variantId,
      variantLabel: i.variantLabel,
      name: i.name,
      sku: i.sku,
      image: i.image,
      price: i.price.toFixed(2),
      costPrice: i.costPrice != null ? i.costPrice.toFixed(2) : null,
      quantity: i.quantity,
      total: (i.price * i.quantity).toFixed(2),
    })),
  )

  await db.insert(orderHistory).values({
    orderId: order.id,
    type: 'status',
    message: `Заказ оформлен через сайт (№${orderNumber})`,
    actor: customerName,
  })

  // Bank-requisite orders: compute the requisites and persist them to the
  // order note BEFORE sending notifications, so the confirmation email the
  // customer receives already contains the payment details.
  let requisites: string | undefined
  if (input.paymentMethod === 'requisites') {
    const { rows } = await pool.query(`SELECT config FROM payment_methods WHERE code='requisites'`)
    const cfg = (rows[0]?.config as Record<string, string> | null) ?? {}
    const parts: string[] = []
    if (cfg.recipientName) parts.push(`Получатель: ${cfg.recipientName}`)
    if (cfg.edrpou) parts.push(`ЕГРПОУ/ИНН: ${cfg.edrpou}`)
    if (cfg.iban) parts.push(`IBAN: ${cfg.iban}`)
    if (cfg.cardNumber) parts.push(`Карта: ${cfg.cardNumber}`)
    if (cfg.cardHolder) parts.push(`Получатель карты: ${cfg.cardHolder}`)
    parts.push(`Назначение платежа: оплата заказа №${orderNumber}`)
    parts.push(`Сумма: ${total} грн`)
    requisites = parts.join('\n')
    await pool
      .query(`UPDATE orders SET note = $1 WHERE id = $2`, [
        `Реквизиты для оплаты:\n${requisites}`,
        order.id,
      ])
      .catch(() => {})
  }

  // Cash / requisite orders are finalized right away. Online orders defer their
  // side effects (stock, promo, analytics) until payment is confirmed.
  if (!isOnline) {
    await applyOrderFulfillment(order.id)
    // Notify customer + admin (email/Telegram). Online orders notify after payment.
    void notifyNewOrder(order.id)
  }

  // If this shopper had an abandoned-cart record, mark it as recovered.
  if (input.cartToken) {
    await pool
      .query(
        `UPDATE abandoned_carts SET status = 'recovered', recovered_order_number = $1, updated_at = NOW()
         WHERE token = $2 AND status IN ('open', 'reminded')`,
        [orderNumber, input.cartToken],
      )
      .catch(() => {})
  }

  // Payment handling.
  let paymentUrl: string | undefined
  if (input.paymentMethod === 'online') {
    const gateway = await pickLiveGateway()
    const baseUrl = getBaseUrl()

    if (gateway && baseUrl) {
      // Real gateway flow: create an invoice and send the shopper to the gateway.
      const serviceUrl = `${baseUrl}/api/payments/${gateway.code}/callback`
      const returnUrl = `${baseUrl}/checkout/return?orderReference=${encodeURIComponent(orderNumber)}`
      const result =
        gateway.code === 'wayforpay'
          ? await wayforpayCreateInvoice(gateway.config, {
              orderReference: orderNumber,
              amount: total,
              currency: 'UAH',
              productName: `Заказ №${orderNumber}`,
              clientEmail: input.email?.trim(),
              clientPhone: input.phone.trim(),
              serviceUrl,
              returnUrl,
            })
          : await monobankCreateInvoice(gateway.config, {
              orderReference: orderNumber,
              amount: total,
              currency: 'UAH',
              description: `Заказ №${orderNumber}`,
              redirectUrl: returnUrl,
              webHookUrl: serviceUrl,
            })

      if (result.ok && result.paymentUrl) {
        await db
          .insert(payments)
          .values({
            gatewayCode: gateway.code,
            orderReference: orderNumber,
            invoiceId: result.invoiceId,
            amount: total.toFixed(2),
            currency: 'UAH',
            status: 'pending',
            description: `Оплата заказа №${orderNumber}`,
            customerName,
            customerEmail: input.email?.trim() || null,
            customerPhone: input.phone.trim(),
            paymentUrl: result.paymentUrl,
            rawResponse: (result.raw as object) ?? null,
          })
          .catch(() => {})
        paymentUrl = result.paymentUrl // external gateway page

        // Remember the order being paid: if the gateway's cabinet overrides
        // our returnUrl (approvedUrl/declinedUrl without orderReference), the
        // /checkout/return page falls back to this cookie.
        // SameSite must be 'none': WayForPay returns the shopper via a
        // cross-site POST, and browsers do not attach 'lax' cookies to those.
        try {
          const jar = await cookies()
          const secure = process.env.NODE_ENV === 'production'
          jar.set('pf_last_order', orderNumber, {
            path: '/',
            maxAge: 60 * 60 * 2, // 2 hours
            httpOnly: true,
            sameSite: secure ? 'none' : 'lax',
            secure,
          })
        } catch {
          /* cookies unavailable in this context — non-fatal */
        }
      } else {
        // A LIVE gateway is configured but invoice creation failed (bad token,
        // gateway outage, ...). Never fall through to the demo payment page in
        // this case — the shopper could "pay" without any real charge. Cancel
        // the order and surface the error so it can be retried or fixed.
        console.log('[v0] Gateway invoice failed:', gateway.code, result.message)
        await pool
          .query(
            `UPDATE orders SET status = 'cancelled', note = COALESCE(note || E'\n', '') || $1 WHERE id = $2`,
            [`Ошибка шлюза ${gateway.code}: ${result.message ?? 'неизвестная ошибка'}`, order.id],
          )
          .catch(() => {})
        return {
          success: false,
          error:
            'Не удалось создать счёт на оплату. Попробуйте ещё раз или выберите другой способ оплаты.',
        }
      }
    }

    if (!paymentUrl) {
      // Fallback: no live gateway (unconfigured/test mode) -> built-in demo page.
      await db
        .insert(payments)
        .values({
          gatewayCode: 'online',
          orderReference: orderNumber,
          amount: total.toFixed(2),
          currency: 'UAH',
          status: 'created',
          description: `Оплата заказа №${orderNumber}`,
          customerName,
          customerEmail: input.email?.trim() || null,
          customerPhone: input.phone.trim(),
        })
        .catch(() => {})
      paymentUrl = `/checkout/pay/${orderNumber}`
    }
  }

  return {
    success: true,
    orderId: order.id,
    orderNumber,
    total,
    itemsTotal,
    discount,
    promoCode: appliedPromoCode ?? undefined,
    paymentMethod: input.paymentMethod,
    paymentUrl,
    requisites,
  }
}

// Demo online payment confirmation. A real gateway would confirm via webhook;
// here we mark the order + payment record as paid and log history.
//
// SECURITY: this is a public server action reachable directly over the
// network with nothing but an order number — it is NOT limited to the
// storefront's own "demo payment" button. It must never be able to settle an
// order that actually went through a real gateway (WayForPay/Monobank),
// otherwise anyone who learns/guesses an order number could call it directly
// and get that order marked paid — and fulfilled (stock shipped) — for free,
// bypassing payment entirely. createStorefrontOrder records a `payments` row
// for every "online" order, but only real gateways use gatewayCode
// 'wayforpay'/'monobank' (the demo fallback uses 'online', see
// createStorefrontOrder) — if a real one is found, the order must be settled
// by that gateway's webhook/status check (settlePayment) instead, so refuse.
const REAL_GATEWAY_CODES = ['wayforpay', 'monobank']

export async function markOrderPaid(orderNumber: string) {
  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1)
  if (!order) return { success: false, error: 'Заказ не найден' }
  if (order.paymentStatus === 'paid') return { success: true }

  const [realGatewayPayment] = await db
    .select({ gatewayCode: payments.gatewayCode })
    .from(payments)
    .where(and(eq(payments.orderReference, orderNumber), inArray(payments.gatewayCode, REAL_GATEWAY_CODES)))
    .limit(1)
  if (realGatewayPayment) {
    return { success: false, error: 'Заказ оплачивается через платёжный шлюз — используйте проверку статуса' }
  }

  await db
    .update(orders)
    .set({ paymentStatus: 'paid', updatedAt: new Date() })
    .where(eq(orders.id, order.id))
  await pool
    .query(`UPDATE payments SET status='paid', updated_at=NOW() WHERE order_reference=$1`, [
      orderNumber,
    ])
    .catch(() => {})
  await db.insert(orderHistory).values({
    orderId: order.id,
    type: 'payment',
    message: 'Оплата получена (онлайн)',
    actor: 'Система',
  })
  // Promote the pending order to a real, finalized order (stock, promo, stats).
  await finalizePaidOrder(orderNumber)
  return { success: true }
}

// SECURITY (defense in depth): this is the guest order-confirmation lookup —
// intentionally unauthenticated (getOrderByNumber has no ownership check) so
// guest checkouts without an account still work. The order number is a
// 12-digit random value (see lib/orders/order-number.ts) which alone is
// already brute-force-infeasible, but a per-IP rate limit here removes even
// the theoretical ability to script through many guesses.
const ORDER_LOOKUP_WINDOW_MS = 60_000
const ORDER_LOOKUP_MAX_PER_WINDOW = 20
const orderLookupHits = new Map<string, { count: number; resetAt: number }>()

async function isOrderLookupRateLimited(): Promise<boolean> {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
  const now = Date.now()
  const entry = orderLookupHits.get(ip)
  if (!entry || now > entry.resetAt) {
    orderLookupHits.set(ip, { count: 1, resetAt: now + ORDER_LOOKUP_WINDOW_MS })
    if (orderLookupHits.size > 10_000) {
      for (const [k, v] of orderLookupHits) if (now > v.resetAt) orderLookupHits.delete(k)
    }
    return false
  }
  entry.count++
  return entry.count > ORDER_LOOKUP_MAX_PER_WINDOW
}

export async function getOrderByNumber(orderNumber: string) {
  if (await isOrderLookupRateLimited()) return null
  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1)
  if (!order) return null
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id))
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.orderReference, orderNumber))
    .orderBy(desc(payments.createdAt))
    .limit(1)
  return { order, items, payment: payment ?? null }
}

// Storefront "check payment status" button on the pay/return page. Re-queries
// the gateway for the authoritative status and settles the order accordingly.
export async function checkOrderPaymentStatus(
  orderNumber: string,
): Promise<{ ok: boolean; status: string; message?: string }> {
  // Public action that triggers outbound gateway API calls — rate-limit so it
  // cannot be scripted to hammer WayForPay/Monobank with our credentials.
  if (isRateLimited('payment-status', await actionClientIp(), 10)) {
    return { ok: false, status: 'unknown', message: 'Слишком много запросов, попробуйте позже' }
  }
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.orderReference, orderNumber))
    .orderBy(desc(payments.createdAt))
    .limit(1)
  if (!payment) return { ok: false, status: 'unknown', message: 'Платёж не найден' }

  const [gateway] = await db
    .select()
    .from(paymentGateways)
    .where(eq(paymentGateways.code, payment.gatewayCode))
    .limit(1)
  const cfg = (gateway?.config ?? {}) as Record<string, string>

  let status = payment.status
  if (payment.gatewayCode === 'wayforpay') {
    const r = await wayforpayCheckStatus(cfg, orderNumber)
    if (r.ok && r.status) status = r.status
  } else if (payment.gatewayCode === 'monobank' && payment.invoiceId) {
    const r = await monobankCheckStatus(cfg, payment.invoiceId)
    if (r.ok && r.status) status = r.status
  } else {
    return { ok: true, status: payment.status }
  }

  await settlePayment(orderNumber, status, { eventType: 'status', message: `Проверка статуса: ${status}` })
  return { ok: true, status }
}

export async function getMyOrders() {
  const user = await getShopUser()
  if (!user) return []
  // Order history is keyed by the account AND by the phone number (the stable
  // customer identifier): guest orders placed with the same phone show up too.
  // Comparison uses the last 9 digits so it is format-independent.
  const phoneDigits = (user.phone ?? '').replace(/\D/g, '')
  const ownership = phoneDigits
    ? or(
        eq(orders.userId, user.id),
        sql`right(regexp_replace(${orders.customerPhone}, '\\D', '', 'g'), 9) = right(${phoneDigits}, 9)`,
      )
    : eq(orders.userId, user.id)
  // Hide orders still awaiting online payment: they only become real orders
  // once the gateway confirms payment (status flips to 'new').
  const rows = await db
    .select()
    .from(orders)
    .where(and(ownership, ne(orders.status, 'pending_payment')))
    .orderBy(desc(orders.createdAt))
  if (rows.length === 0) return []
  const allItems = await db
    .select()
    .from(orderItems)
    .where(
      inArray(
        orderItems.orderId,
        rows.map((r) => r.id),
      ),
    )
  return rows.map((order) => {
    const items = allItems.filter((i) => i.orderId === order.id)
    return {
      ...order,
      items,
      itemsCount: items.reduce((n, i) => n + i.quantity, 0),
    }
  })
}

export async function getMyOrderDetail(orderId: number) {
  const user = await getShopUser()
  if (!user) return null
  // Same ownership rule as getMyOrders: by account or by the account's phone.
  const phoneDigits = (user.phone ?? '').replace(/\D/g, '')
  const ownership = phoneDigits
    ? or(
        eq(orders.userId, user.id),
        sql`right(regexp_replace(${orders.customerPhone}, '\\D', '', 'g'), 9) = right(${phoneDigits}, 9)`,
      )
    : eq(orders.userId, user.id)
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), ownership))
    .limit(1)
  if (!order) return null
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id))
  const { buildOrderReceipt } = await import('@/lib/receipts/build-receipt')
  const receiptData = await buildOrderReceipt(order, items)
  const receipt = {
    storeName: receiptData.storeName,
    qrDataUrl: receiptData.qrDataUrl,
    isFiscal: receiptData.isFiscal,
  }
  return { order, items, receipt }
}

export async function submitReview(input: {
  productId: number
  rating: number
  body: string
  pros?: string
  cons?: string
  authorName?: string
  authorEmail?: string
}) {
  // Public, unauthenticated write — rate-limit per IP to stop spam floods.
  if (await isFeedbackRateLimited('reviews')) {
    return { success: false, error: 'Слишком много запросов, попробуйте позже' }
  }
  const user = await getShopUser()
  const name = (input.authorName?.trim() || user?.name || 'Аноним').slice(0, 120)
  if (!input.body?.trim()) return { success: false, error: 'Введите текст отзыва' }
  await db.insert(productReviews).values({
    productId: input.productId,
    authorName: name,
    authorEmail: (input.authorEmail?.trim() || user?.email || null)?.slice(0, 255) ?? null,
    rating: Math.min(5, Math.max(1, input.rating)),
    body: input.body.trim().slice(0, 5000),
    pros: input.pros?.trim().slice(0, 2000) || null,
    cons: input.cons?.trim().slice(0, 2000) || null,
    status: 'pending',
  })
  return { success: true }
}

export async function submitQuestion(input: {
  productId: number
  question: string
  authorName?: string
  authorEmail?: string
}) {
  // Public, unauthenticated write — rate-limit per IP to stop spam floods.
  if (await isFeedbackRateLimited('questions')) {
    return { success: false, error: 'Слишком много запросов, попробуйте позже' }
  }
  const user = await getShopUser()
  const name = (input.authorName?.trim() || user?.name || 'Аноним').slice(0, 120)
  if (!input.question?.trim()) return { success: false, error: 'Введите вопрос' }
  await db.insert(productQuestions).values({
    productId: input.productId,
    authorName: name,
    authorEmail: (input.authorEmail?.trim() || user?.email || null)?.slice(0, 255) ?? null,
    question: input.question.trim().slice(0, 3000),
    status: 'pending',
  })
  return { success: true }
}

// Shared per-IP limiter for the storefront review/question forms (server
// actions can't read the IP from a Request object, so resolve it via headers).
async function isFeedbackRateLimited(scope: string): Promise<boolean> {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
  return isRateLimited(scope, ip, 5)
}
