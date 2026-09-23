'use server'

import { cookies, headers } from 'next/headers'
import { and, desc, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm'
import { db, pool, withDbClient, dbForClient } from '@/lib/db'
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
import { getProductSlugMap } from '@/lib/shop/queries'
import { evaluatePromoCode, findBestAutomaticDiscount } from '@/app/actions/promotions'
import { applyOrderFulfillment, finalizePaidOrder } from '@/lib/shop/order-fulfillment'
import { notifyNewOrder } from '@/lib/notifications'
import { generateUniqueOrderNumber } from '@/lib/orders/order-number'
import { clientIpFromHeaders, isRateLimited } from '@/lib/api/rate-limit'
import { mergeCheckoutItems, validateCheckoutInput } from '@/lib/shop/checkout-validation'
import { getStoreSettingsInternal } from '@/lib/store-settings'
import { getLocale } from '@/lib/i18n/server'
import { localizedPath } from '@/lib/i18n/config'
import { getDictionary, fillTemplate } from '@/lib/i18n/dictionaries'
import { formatPrice } from '@/lib/shop/format'
import { computeOrderTotals } from '@/lib/shop/order-totals'
import { composeCheckoutNote, formatRequisitesNote } from '@/lib/payments/public-requisites'

const LAST_ORDER_COOKIE = 'pf_last_order'

async function rememberLastOrder(orderNumber: string) {
  try {
    const jar = await cookies()
    const secure = process.env.NODE_ENV === 'production'
    jar.set(LAST_ORDER_COOKIE, orderNumber, {
      path: '/',
      maxAge: 60 * 60 * 2, // 2 hours
      httpOnly: true,
      sameSite: secure ? 'none' : 'lax',
      secure,
    })
  } catch {
    /* cookies unavailable in this context — non-fatal */
  }
}

async function lastOrderFromCookie(): Promise<string | undefined> {
  try {
    return (await cookies()).get(LAST_ORDER_COOKIE)?.value
  } catch {
    return undefined
  }
}

async function canAccessGuestOrder(order: { orderNumber: string; userId: string | null }): Promise<boolean> {
  const shopper = await getShopUser()
  if (shopper && order.userId && shopper.id === order.userId) return true
  return (await lastOrderFromCookie()) === order.orderNumber
}

/** Client IP for server actions (no Request object available — use headers). */
async function actionClientIp(): Promise<string> {
  return clientIpFromHeaders(await headers())
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
  deliveryWarehouseRef?: string
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
  const locale = await getLocale()
  const t = getDictionary(locale).serverErrors

  // SECURITY: public, unauthenticated server action — rate-limit per IP to
  // stop order-spam floods (every order writes DB rows, upserts a customer and
  // fires admin/customer notifications). Two buckets: burst + sustained.
  const ip = await actionClientIp()
  if (await isRateLimited('checkout', ip, 5) || await isRateLimited('checkout-hourly', ip, 30, 3_600_000)) {
    return { success: false, error: t.rateLimitOrders }
  }

  // Strict validation of hostile input: caps every string, requires a
  // plausible phone/email, rejects NaN / non-integer / oversized quantities
  // (NaN used to slip past the stock check: `p.quantity < NaN` is false) and
  // caps the number of cart lines. See lib/shop/checkout-validation.ts.
  const validated = validateCheckoutInput(input, locale)
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
      variantsEnabled: products.variantsEnabled,
    })
    .from(products)
    .where(and(inArray(products.id, ids), sql`${products.deletedAt} IS NULL`))

  const byId = new Map(rows.map((r) => [r.id, r]))

  // Drop variantId on products with variants disabled, then merge so
  // duplicate parent-SKU lines share one stock check (FIX-13 + FIX-22).
  input.items = mergeCheckoutItems(
    input.items.map((i) =>
      i.variantId != null && !byId.get(i.productId)?.variantsEnabled
        ? { productId: i.productId, quantity: i.quantity }
        : i,
    ),
  )

  // Load any variants referenced by the cart to validate per-variant stock/price.
  // Disabled variants (FIX-22) are ignored — parent product price/qty win.
  const variantIds = input.items
    .filter((i) => i.variantId != null && byId.get(i.productId)?.variantsEnabled)
    .map((i) => i.variantId)
    .filter((v): v is number => typeof v === 'number')
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
    if (!p) return { success: false, error: t.someItemsUnavailable }
    const qty = Math.max(1, Math.floor(it.quantity))

    if (it.variantId != null && p.variantsEnabled) {
      const v = variantById.get(it.variantId)
      if (!v || v.productId !== p.id) {
        return { success: false, error: fillTemplate(t.variantUnavailable, { name: p.name }) }
      }
      const label = variantLabel((v.options ?? {}) as VariantOptions)
      if (!v.isInStock || v.quantity < qty) {
        return { success: false, error: fillTemplate(t.variantOutOfStock, { name: p.name, label }) }
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
      return { success: false, error: fillTemplate(t.productOutOfStock, { name: p.name }) }
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
    const dict = getDictionary(locale)
    return {
      success: false,
      error: `${dict.checkout.minOrderPrefix} ${formatPrice(minOrder.amount, 'UAH', locale)}. ${dict.checkout.minOrderAddMore} ${formatPrice(minOrder.amount - itemsTotal, 'UAH', locale)}.`,
    }
  }

  // Authoritatively re-evaluate the promo code AND any automatic ("type:
  // discount") promotion (never trust a client discount). Only the resulting
  // code/amounts are persisted here; usage is recorded at fulfillment.
  const promoLines = lineItems.map((i) => ({ productId: i.productId, price: i.price, quantity: i.quantity }))

  let manualPromo: Awaited<ReturnType<typeof evaluatePromoCode>> | null = null
  if (input.promoCode?.trim()) {
    manualPromo = await evaluatePromoCode(input.promoCode, promoLines)
    if (!manualPromo.ok) return { success: false, error: manualPromo.error }
  }
  const autoPromo = await findBestAutomaticDiscount(promoLines)

  let discount = 0
  let appliedPromoCode: string | null = null
  let autoDiscountId: number | null = null
  let autoDiscountAmount = 0

  if (manualPromo?.ok && autoPromo.ok) {
    // Either side can veto combining discounts — if so, only the larger of
    // the two applies (never both, and never silently the smaller one).
    if (manualPromo.noStacking || autoPromo.noStacking) {
      if (manualPromo.discount >= autoPromo.discount) {
        discount = manualPromo.discount
        appliedPromoCode = manualPromo.code
      } else {
        discount = autoPromo.discount
        autoDiscountId = autoPromo.promotionId
        autoDiscountAmount = autoPromo.discount
      }
    } else {
      appliedPromoCode = manualPromo.code
      autoDiscountId = autoPromo.promotionId
      autoDiscountAmount = autoPromo.discount
      discount = Math.min(manualPromo.discount + autoPromo.discount, itemsTotal)
    }
  } else if (manualPromo?.ok) {
    discount = manualPromo.discount
    appliedPromoCode = manualPromo.code
  } else if (autoPromo.ok) {
    discount = autoPromo.discount
    autoDiscountId = autoPromo.promotionId
    autoDiscountAmount = autoPromo.discount
  }

  const { total } = computeOrderTotals({ itemsTotal, discount, deliveryCost: 0 })
  const itemsCount = lineItems.reduce((s, i) => s + i.quantity, 0)
  const orderNumber = await generateUniqueOrderNumber()
  const shopUser = await getShopUser()
  const customerName = `${input.firstName.trim()} ${input.lastName?.trim() ?? ''}`.trim()
  const customerEmail = input.email?.trim() || shopUser?.email?.trim() || null

  // Online-gateway orders start as "pending_payment": they are not finalized
  // (no stock/promo side effects, hidden from the customer's order list) until
  // the payment is confirmed. Cash/requisite orders are placed immediately.
  const isOnline = input.paymentMethod === 'online'
  const utm = await readUtmAttribution()

  // Bank-requisite preview is computed before the write so a failed format
  // cannot leave a committed order without payment details.
  let requisites: string | undefined
  let requisitesNote: string | undefined
  if (input.paymentMethod === 'requisites') {
    const { rows } = await pool.query(`SELECT config FROM payment_methods WHERE code='requisites'`)
    const cfg = (rows[0]?.config as Record<string, string> | null) ?? {}
    const { formatRequisitesPreview } = await import('@/lib/payments/public-requisites')
    const loc = locale === 'ru' ? 'ru' as const : 'uk' as const
    requisites = formatRequisitesPreview(cfg, { amount: Number(total), locale: loc, orderNumber })
    requisitesNote = formatRequisitesNote(requisites, loc)
  }

  let order: { id: number }
  try {
    order = await withDbClient(async (client) => {
      const tx = dbForClient(client)

      // Upsert a customer record by phone. Unique on phone is not guaranteed
      // on every install, so a concurrent insert can still collide — retry
      // by selecting the existing row.
      let customerId: number | undefined
      const [existingCustomer] = await tx
        .select()
        .from(customers)
        .where(and(eq(customers.phone, input.phone.trim()), isNull(customers.deletedAt)))
        .limit(1)
      if (existingCustomer) {
        customerId = existingCustomer.id
      } else {
        try {
          const [c] = await tx
            .insert(customers)
            .values({
              firstName: input.firstName.trim(),
              lastName: input.lastName?.trim() || null,
              phone: input.phone.trim(),
              email: customerEmail,
            })
            .returning()
          customerId = c.id
        } catch {
          const [again] = await tx
            .select()
            .from(customers)
            .where(and(eq(customers.phone, input.phone.trim()), isNull(customers.deletedAt)))
            .limit(1)
          customerId = again?.id
        }
      }

      const [created] = await tx
        .insert(orders)
        .values({
          orderNumber,
          status: isOnline ? 'pending_payment' : 'new',
          ...utm,
          customerId,
          customerName,
          customerPhone: input.phone.trim(),
          customerEmail,
          deliveryMethod: input.deliveryMethod,
          deliveryCity: input.deliveryCity || null,
          deliveryCityRef: input.deliveryCityRef || null,
          deliveryBranch: input.deliveryBranch || null,
          deliveryWarehouseRef: input.deliveryWarehouseRef || null,
          deliveryAddress: input.deliveryAddress || null,
          paymentMethod: input.paymentMethod,
          paymentStatus: 'unpaid',
          itemsTotal: itemsTotal.toFixed(2),
          deliveryCost: '0',
          discountTotal: discount.toFixed(2),
          promoCode: appliedPromoCode,
          autoDiscountId,
          autoDiscountAmount: autoDiscountId ? autoDiscountAmount.toFixed(2) : null,
          total: total.toFixed(2),
          itemsCount,
          note: composeCheckoutNote(requisitesNote, input.note),
          createdBy: shopUser ? shopUser.id : null,
          userId: shopUser ? shopUser.id : null,
        })
        .returning()

      await tx.insert(orderItems).values(
        lineItems.map((i) => ({
          orderId: created.id,
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

      await tx.insert(orderHistory).values({
        orderId: created.id,
        type: 'status',
        message: `Заказ оформлен через сайт (№${orderNumber})`,
        actor: customerName,
      })

      // Cash / requisite orders are finalized right away. Online orders defer
      // their side effects (stock, promo, analytics) until payment is confirmed.
      if (!isOnline) {
        await applyOrderFulfillment(created.id, client)
      }

      return { id: created.id }
    })
  } catch (e) {
    console.error('[checkout] order write failed:', (e as Error).message)
    return { success: false, error: t.paymentInvoiceFailed }
  }

  if (input.cartToken) {
    await pool
      .query(
        `UPDATE abandoned_carts SET status = 'recovered', recovered_order_number = $1, updated_at = NOW()
         WHERE token = $2 AND status IN ('open', 'reminded')`,
        [orderNumber, input.cartToken],
      )
      .catch(() => {})
  }

  if (!isOnline) {
    void notifyNewOrder(order.id)
  }

  // Payment handling.
  let paymentUrl: string | undefined
  if (input.paymentMethod === 'online') {
    const gateway = await pickLiveGateway()
    const baseUrl = getBaseUrl()

    if (gateway && baseUrl) {
      // Real gateway flow: create an invoice and send the shopper to the gateway.
      const serviceUrl = `${baseUrl}/api/payments/${gateway.code}/callback`
      const returnUrl = `${baseUrl}${localizedPath('/checkout/return', locale)}?orderReference=${encodeURIComponent(orderNumber)}`
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
        try {
          await db.insert(payments).values({
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
        } catch (e) {
          console.error('[checkout] payment row failed:', (e as Error).message)
          await pool.query(
            `UPDATE orders SET status = 'cancelled', note = COALESCE(note || E'\n', '') || $1 WHERE id = $2`,
            ['Не удалось сохранить платёж после создания инвойса шлюза', order.id],
          )
          return { success: false, error: t.paymentInvoiceFailed }
        }
        paymentUrl = result.paymentUrl // external gateway page
      } else {
        // A LIVE gateway is configured but invoice creation failed (bad token,
        // gateway outage, ...). Never fall through to the demo payment page in
        // this case — the shopper could "pay" without any real charge. Cancel
        // the order and surface the error so it can be retried or fixed.
        console.log('[v0] Gateway invoice failed:', gateway.code, result.message)
        await pool.query(
          `UPDATE orders SET status = 'cancelled', note = COALESCE(note || E'\n', '') || $1 WHERE id = $2`,
          [`Ошибка шлюза ${gateway.code}: ${result.message ?? 'неизвестная ошибка'}`, order.id],
        )
        return {
          success: false,
          error: t.paymentInvoiceFailed,
        }
      }
    }

    if (!paymentUrl) {
      // No live gateway (unconfigured / test mode). Do not fall through to the
      // built-in demo page — that lets the shopper mark the order paid with no
      // real charge. Cancel and ask them to pick another method.
      await pool.query(
        `UPDATE orders SET status = 'cancelled', note = COALESCE(note || E'\\n', '') || $1 WHERE id = $2`,
        ['Онлайн-оплата недоступна: нет живого шлюза', order.id],
      )
      return { success: false, error: t.paymentInvoiceFailed }
    }
  }

  // Guest confirmation/pay pages treat the order number as a capability.
  // Bind it to this browser so /order/[n] and /checkout/pay/[n] are not a
  // public lookup of another customer's PII. SameSite=none in production so
  // WayForPay's cross-site POST return still attaches the cookie.
  await rememberLastOrder(orderNumber)

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

export async function markOrderPaid(_orderNumber: string) {
  const t = getDictionary(await getLocale()).serverErrors
  // Demo payments are disabled; orders are settled only via gateway
  // webhooks / status checks. Kept as a stub so old /checkout/pay pages
  // fail closed instead of fulfilling for free.
  return { success: false, error: t.orderPaidViaGateway }
}

// Guest order-confirmation / pay-page lookup. The 12-digit order number is
// still a high-entropy capability (see lib/orders/order-number.ts), but the
// page also leaks PII (phone, email, address). Require the shopper who just
// checked out (pf_last_order cookie) or the logged-in owner. Rate-limit
// leftover guesses.
const ORDER_LOOKUP_WINDOW_MS = 60_000
const ORDER_LOOKUP_MAX_PER_WINDOW = 20
const orderLookupHits = new Map<string, { count: number; resetAt: number }>()

async function isOrderLookupRateLimited(): Promise<boolean> {
  const ip = clientIpFromHeaders(await headers())
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
  if (!(await canAccessGuestOrder(order))) return null
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id))
  const productSlugs = await getProductSlugMap(items.map((i) => i.productId))
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.orderReference, orderNumber))
    .orderBy(desc(payments.createdAt))
    .limit(1)
  return { order, items, productSlugs, payment: payment ?? null }
}

// Storefront "check payment status" button on the pay/return page. Re-queries
// the gateway for the authoritative status and settles the order accordingly.
export async function checkOrderPaymentStatus(
  orderNumber: string,
): Promise<{ ok: boolean; status: string; message?: string }> {
  // Public action that triggers outbound gateway API calls — rate-limit so it
  // cannot be scripted to hammer WayForPay/Monobank with our credentials.
  if (await isRateLimited('payment-status', await actionClientIp(), 10)) {
    return { ok: false, status: 'unknown', message: 'Слишком много запросов, попробуйте позже' }
  }
  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1)
  if (!order || !(await canAccessGuestOrder(order))) {
    return { ok: false, status: 'unknown', message: 'Платёж не найден' }
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
  let amount: number | undefined
  if (payment.gatewayCode === 'wayforpay') {
    const r = await wayforpayCheckStatus(cfg, orderNumber)
    if (r.ok && r.status) {
      status = r.status
      amount = r.amount
    }
  } else if (payment.gatewayCode === 'monobank' && payment.invoiceId) {
    const r = await monobankCheckStatus(cfg, payment.invoiceId)
    if (r.ok && r.status) {
      status = r.status
      amount = r.amount
    }
  } else {
    return { ok: true, status: payment.status }
  }

  await settlePayment(orderNumber, status, {
    eventType: 'status',
    message: `Проверка статуса: ${status}`,
    amount,
  })
  return { ok: true, status }
}

const myOrderColumns = {
  id: orders.id,
  orderNumber: orders.orderNumber,
  status: orders.status,
  paymentStatus: orders.paymentStatus,
  paymentMethod: orders.paymentMethod,
  note: orders.note,
  createdAt: orders.createdAt,
  total: orders.total,
  discountTotal: orders.discountTotal,
  promoCode: orders.promoCode,
  trackingNumber: orders.trackingNumber,
  customerName: orders.customerName,
  customerPhone: orders.customerPhone,
  customerEmail: orders.customerEmail,
  deliveryMethod: orders.deliveryMethod,
  deliveryCity: orders.deliveryCity,
  deliveryBranch: orders.deliveryBranch,
  deliveryAddress: orders.deliveryAddress,
  userId: orders.userId,
}

const myOrderItemColumns = {
  id: orderItems.id,
  orderId: orderItems.orderId,
  productId: orderItems.productId,
  name: orderItems.name,
  image: orderItems.image,
  quantity: orderItems.quantity,
  price: orderItems.price,
  total: orderItems.total,
  variantLabel: orderItems.variantLabel,
}

function orderOwnership(userId: string, phone: string | null) {
  const phoneDigits = (phone ?? '').replace(/\D/g, '')
  if (!phoneDigits) return eq(orders.userId, userId)
  return or(
    eq(orders.userId, userId),
    sql`right(regexp_replace(coalesce(${orders.customerPhone}, ''), '[^0-9]', '', 'g'), 9) = right(${phoneDigits}, 9)`,
  )
}

export async function getMyOrders() {
  const user = await getShopUser()
  if (!user) return []
  try {
    // Order history is keyed by the account AND by the phone number (the stable
    // customer identifier): guest orders placed with the same phone show up too.
    // Comparison uses the last 9 digits so it is format-independent.
    const ownership = orderOwnership(user.id, user.phone)
    // Hide orders still awaiting online payment: they only become real orders
    // once the gateway confirms payment (status flips to 'new').
    // Explicit columns — `select()` would 500 if production is missing a later
    // orders.* column (utm_*, auto_discount_*, stock_restored).
    const rows = await db
      .select(myOrderColumns)
      .from(orders)
      .where(and(ownership, ne(orders.status, 'pending_payment')))
      .orderBy(desc(orders.createdAt))
      .limit(50)
    if (rows.length === 0) return []
    const allItems = await db
      .select(myOrderItemColumns)
      .from(orderItems)
      .where(
        inArray(
          orderItems.orderId,
          rows.map((r) => r.id),
        ),
      )
    const productSlugs = await getProductSlugMap(allItems.map((i) => i.productId))
    return rows.map((order) => {
      const items = allItems.filter((i) => i.orderId === order.id)
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        total: order.total,
        items,
        productSlugs,
        itemsCount: items.reduce((n, i) => n + i.quantity, 0),
      }
    })
  } catch (e) {
    console.error('[account/orders] getMyOrders failed:', e)
    throw e
  }
}

export async function getMyOrderDetail(orderId: number) {
  const user = await getShopUser()
  if (!user) return null
  try {
    // Same ownership rule as getMyOrders: by account or by the account's phone.
    const ownership = orderOwnership(user.id, user.phone)
    // Explicit columns — `select()` 500s (then this catch turned it into 404)
    // if production is missing a later orders.* column.
    const [order] = await db
      .select(myOrderColumns)
      .from(orders)
      .where(and(eq(orders.id, orderId), ownership, ne(orders.status, 'pending_payment')))
      .limit(1)
    if (!order) return null
    const items = await db
      .select(myOrderItemColumns)
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id))
    const productSlugs = await getProductSlugMap(items.map((i) => i.productId))
    return { order, items, productSlugs }
  } catch (e) {
    console.error('[account/orders] getMyOrderDetail failed:', e)
    return null
  }
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
  const locale = await getLocale()
  const dict = getDictionary(locale)
  // Public, unauthenticated write — rate-limit per IP to stop spam floods.
  if (await isFeedbackRateLimited('reviews')) {
    return { success: false, error: dict.serverErrors.rateLimitGeneric }
  }
  const user = await getShopUser()
  const name = (input.authorName?.trim() || user?.name || dict.common.anonymous).slice(0, 120)
  if (!input.body?.trim()) return { success: false, error: dict.serverErrors.reviewTextRequired }
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
  const dict = getDictionary(await getLocale())
  // Public, unauthenticated write — rate-limit per IP to stop spam floods.
  if (await isFeedbackRateLimited('questions')) {
    return { success: false, error: dict.serverErrors.rateLimitGeneric }
  }
  const user = await getShopUser()
  const name = (input.authorName?.trim() || user?.name || dict.common.anonymous).slice(0, 120)
  if (!input.question?.trim()) return { success: false, error: dict.serverErrors.questionRequired }
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
  return await isRateLimited(scope, clientIpFromHeaders(await headers()), 5)
}
