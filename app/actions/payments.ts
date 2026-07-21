'use server'

import { db } from '@/lib/db'
import { paymentGateways, payments, paymentEvents, orders, orderHistory } from '@/lib/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/shop/queries'
import { assertPermission } from '@/lib/session'
import {
  wayforpayCreateInvoice,
  wayforpayCheckStatus,
  wayforpayRefund,
  monobankCreateInvoice,
  monobankCheckStatus,
  monobankRefund,
  type GatewayResult,
} from '@/lib/payments/clients'

type ActionResult = { ok: boolean; message: string; paymentUrl?: string }

/* ------------------------------- Gateways -------------------------------- */

// SECURITY: was missing any permission check even though it returns the full
// gateway `config` column — including the live WayForPay merchantSecretKey
// and Monobank API token. As a server action it's reachable directly over the
// network regardless of the admin page-level route guard, so anyone (no
// login required) could previously call this and read those secrets, which
// would let them forge valid WayForPay webhook signatures (mark any order
// "paid" for free) or call Monobank's API as the merchant.
export async function getGateways() {
  await assertPermission('payments')
  return db.select().from(paymentGateways).orderBy(paymentGateways.sortOrder)
}

async function getGateway(code: string) {
  const [g] = await db.select().from(paymentGateways).where(eq(paymentGateways.code, code))
  return g
}

export async function updateGateway(
  code: string,
  data: { isActive: boolean; isTestMode: boolean; config: Record<string, string> },
): Promise<ActionResult> {
  try {
    await assertPermission('payments')

    // Validate the Monobank acquiring token against the live API before
    // activating: a personal-API or mistyped token silently breaks checkout.
    let warning = ''
    if (code === 'monobank' && data.isActive && !data.isTestMode && data.config.token) {
      try {
        const res = await fetch('https://api.monobank.ua/api/merchant/details', {
          headers: { 'X-Token': data.config.token },
          signal: AbortSignal.timeout(10_000),
        })
        if (res.status === 403 || res.status === 401) {
          return {
            ok: false,
            message:
              'Monobank отклонил токен (403 forbidden). Убедитесь, что это токен ЭКВАЙРИНГА из кабинета web.monobank.ua/acquiring (раздел «Інтернет-еквайринг → Токени»), а не персональный API-токен.',
          }
        }
        if (!res.ok) warning = ` (внимание: Monobank API ответил ${res.status})`
      } catch {
        warning = ' (не удалось проверить токен — Monobank API недоступен)'
      }
    }

    await db
      .update(paymentGateways)
      .set({
        isActive: data.isActive,
        isTestMode: data.isTestMode,
        config: data.config,
        updatedAt: new Date(),
      })
      .where(eq(paymentGateways.code, code))
    revalidatePath('/admin/payments')
    revalidateTag(CACHE_TAGS.checkout, 'max')
    return { ok: true, message: `Настройки шлюза сохранены. Токен проверен${warning || ' — действителен'}` }
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }
}

/* ------------------------------- Payments -------------------------------- */

export async function getPayments() {
  await assertPermission('payments')
  return db.select().from(payments).orderBy(desc(payments.createdAt))
}

// SECURITY: no permission check — reachable directly as a server action
// regardless of whether any current page imports it. Returns raw gateway
// callback payloads (customer name/email/phone, transaction data) for any
// paymentId with no ownership check, so it was an unauthenticated IDOR.
export async function getPaymentEvents(paymentId: number) {
  await assertPermission('payments')
  return db
    .select()
    .from(paymentEvents)
    .where(eq(paymentEvents.paymentId, paymentId))
    .orderBy(desc(paymentEvents.createdAt))
}

async function logEvent(
  paymentId: number,
  type: string,
  result: GatewayResult,
  amount?: number,
) {
  await db.insert(paymentEvents).values({
    paymentId,
    type,
    status: result.status,
    amount: amount != null ? amount.toFixed(2) : null,
    message: result.message,
    payload: (result.raw as object) ?? null,
  })
}

function genOrderRef() {
  return `WFP-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

export async function createPayment(input: {
  gatewayCode: string
  amount: number
  currency: string
  description: string
  customerName?: string
  customerEmail?: string
  customerPhone?: string
}): Promise<ActionResult> {
  await assertPermission('payments')
  const gateway = await getGateway(input.gatewayCode)
  if (!gateway) return { ok: false, message: 'Шлюз не найден' }
  if (!gateway.isActive) return { ok: false, message: 'Шлюз отключён. Активируйте его во вкладке «Шлюзы».' }
  if (!input.amount || input.amount <= 0) return { ok: false, message: 'Укажите корректную сумму' }

  const orderReference = genOrderRef()
  const config = (gateway.config ?? {}) as Record<string, string>
  const origin = process.env.V0_RUNTIME_URL || process.env.VERCEL_URL || ''
  const baseUrl = origin.startsWith('http') ? origin : origin ? `https://${origin}` : ''

  let result: GatewayResult
  if (gateway.isTestMode) {
    // Тестовый режим: имитируем создание счёта без вызова внешнего API
    result = {
      ok: true,
      status: 'pending',
      invoiceId: `TEST-${orderReference}`,
      message: 'Тестовый счёт создан (без реального API)',
      raw: { test: true, orderReference },
    }
  } else if (input.gatewayCode === 'wayforpay') {
    result = await wayforpayCreateInvoice(config, {
      orderReference,
      amount: input.amount,
      currency: input.currency,
      productName: input.description || 'Оплата заказа',
      clientEmail: input.customerEmail,
      clientPhone: input.customerPhone,
    })
  } else if (input.gatewayCode === 'monobank') {
    result = await monobankCreateInvoice(config, {
      orderReference,
      amount: input.amount,
      currency: input.currency,
      description: input.description || 'Оплата заказа',
      redirectUrl: baseUrl ? `${baseUrl}/payments` : undefined,
    })
  } else {
    return { ok: false, message: 'Неизвестный шлюз' }
  }

  const [payment] = await db
    .insert(payments)
    .values({
      gatewayCode: input.gatewayCode,
      orderReference,
      invoiceId: result.invoiceId,
      amount: input.amount.toFixed(2),
      currency: input.currency,
      status: result.ok ? 'pending' : 'failed',
      description: input.description,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      paymentUrl: result.paymentUrl,
      rawResponse: (result.raw as object) ?? null,
    })
    .returning()

  await logEvent(payment.id, 'create', result, input.amount)
  revalidatePath('/admin/payments')

  if (!result.ok) return { ok: false, message: result.message || 'Ошибка создания платежа' }
  return { ok: true, message: 'Счёт на оплату создан', paymentUrl: result.paymentUrl }
}

export async function refreshPaymentStatus(paymentId: number): Promise<ActionResult> {
  await assertPermission('payments')
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId))
  if (!payment) return { ok: false, message: 'Платёж не найден' }
  const gateway = await getGateway(payment.gatewayCode)
  if (!gateway) return { ok: false, message: 'Шлюз не найден' }
  const config = (gateway.config ?? {}) as Record<string, string>

  if (gateway.isTestMode) {
    return { ok: true, message: `Тестовый режим: текущий статус «${payment.status}»` }
  }

  let result: GatewayResult
  if (payment.gatewayCode === 'wayforpay') {
    result = await wayforpayCheckStatus(config, payment.orderReference)
  } else if (payment.gatewayCode === 'monobank') {
    if (!payment.invoiceId) return { ok: false, message: 'Отсутствует invoiceId' }
    result = await monobankCheckStatus(config, payment.invoiceId)
  } else {
    return { ok: false, message: 'Неизвестный шлюз' }
  }

  await logEvent(payment.id, 'status', result)

  if (result.ok && result.status) {
    const keepRefunded = payment.status === 'refunded' && result.status !== 'refunded'
    await db
      .update(payments)
      .set({ status: keepRefunded ? 'refunded' : result.status, updatedAt: new Date() })
      .where(eq(payments.id, paymentId))
    revalidatePath('/admin/payments')
    return { ok: true, message: `Статус обновлён: ${result.status}` }
  }
  return { ok: false, message: result.message || 'Не удалось получить статус' }
}

export async function refundPayment(
  paymentId: number,
  amount?: number,
): Promise<ActionResult> {
  await assertPermission('payments')
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId))
  if (!payment) return { ok: false, message: 'Платёж не найден' }
  if (payment.status === 'refunded') {
    return { ok: false, message: 'Платёж уже полностью возвращён' }
  }
  if (payment.status !== 'paid' && payment.status !== 'partially_refunded') {
    return { ok: false, message: 'Возврат возможен только для оплаченных платежей' }
  }
  const gateway = await getGateway(payment.gatewayCode)
  if (!gateway) return { ok: false, message: 'Шлюз не найден' }
  const config = (gateway.config ?? {}) as Record<string, string>

  const total = Number(payment.amount)
  const alreadyRefunded = Number(payment.refundedAmount)
  const refundAmount = amount && amount > 0 ? amount : total - alreadyRefunded
  if (refundAmount <= 0) return { ok: false, message: 'Нет доступной суммы для возврата' }
  if (alreadyRefunded + refundAmount > total + 0.001) {
    return { ok: false, message: 'Сумма возврата превышает сумму платежа' }
  }

  let result: GatewayResult
  if (gateway.isTestMode) {
    result = {
      ok: true,
      status: 'refunded',
      refundedAmount: refundAmount,
      message: 'Тестовый возврат (без реального API)',
      raw: { test: true },
    }
  } else if (payment.gatewayCode === 'wayforpay') {
    result = await wayforpayRefund(config, {
      orderReference: payment.orderReference,
      amount: refundAmount,
      currency: payment.currency,
      comment: 'Возврат средств',
    })
  } else if (payment.gatewayCode === 'monobank') {
    if (!payment.invoiceId) return { ok: false, message: 'Отсутствует invoiceId' }
    result = await monobankRefund(config, { invoiceId: payment.invoiceId, amount: refundAmount })
  } else {
    return { ok: false, message: 'Неизвестный шлюз' }
  }

  await logEvent(payment.id, 'refund', result, refundAmount)

  if (result.ok) {
    const newRefunded = alreadyRefunded + refundAmount
    const fullyRefunded = newRefunded >= total - 0.001
    await db
      .update(payments)
      .set({
        refundedAmount: newRefunded.toFixed(2),
        status: fullyRefunded ? 'refunded' : 'partially_refunded',
        updatedAt: new Date(),
      })
      .where(eq(payments.id, paymentId))
    revalidatePath('/admin/payments')
    return {
      ok: true,
      message: `Возврат ${refundAmount.toFixed(2)} ${payment.currency} выполнен`,
    }
  }
  return { ok: false, message: result.message || 'Ошибка возврата' }
}

/* ------------------------- Simulation (test mode) ------------------------ */

export async function markPaymentPaid(paymentId: number): Promise<ActionResult> {
  await assertPermission('payments')
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId))
  if (!payment) return { ok: false, message: 'Платёж не найден' }
  const gateway = await getGateway(payment.gatewayCode)
  if (!gateway?.isTestMode) {
    return { ok: false, message: 'Ручная отметка доступна только в тестовом режиме' }
  }
  await db
    .update(payments)
    .set({ status: 'paid', updatedAt: new Date() })
    .where(and(eq(payments.id, paymentId), eq(payments.gatewayCode, payment.gatewayCode)))
  await db.insert(paymentEvents).values({
    paymentId,
    type: 'manual',
    status: 'paid',
    amount: payment.amount,
    message: 'Отмечено оплаченным вручную (тестовый режим)',
  })
  revalidatePath('/admin/payments')
  return { ok: true, message: 'Платёж отмечен как оплаченный' }
}
