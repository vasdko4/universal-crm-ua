'use server'

import { randomInt } from 'node:crypto'
import { db, pool } from '@/lib/db'
import { paymentGateways, payments, paymentEvents, orders, orderHistory } from '@/lib/db/schema'
import { desc, eq, count } from 'drizzle-orm'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/shop/queries'
import { assertPermission, assertWritePermission } from '@/lib/session'
import {
  wayforpayCreateInvoice,
  wayforpayCheckStatus,
  wayforpayRefund,
  monobankCreateInvoice,
  monobankCheckStatus,
  monobankRefund,
  reconcilePendingRefund,
  type GatewayResult,
} from '@/lib/payments/clients'
import { refundPlan } from '@/lib/payments/refund'
import { settlePayment } from '@/lib/payments/settle'
import { normalizePaymentPage, totalPages, type PaymentPageParams } from '@/lib/payments/pagination'
import { restoreStockOnce } from '@/lib/shop/order-fulfillment'
import { decryptConfigSecrets, encryptConfigSecrets } from '@/lib/secrets'

type ActionResult = { ok: boolean; message: string; paymentUrl?: string; ambiguous?: boolean }

/* ------------------------------- Gateways -------------------------------- */

// SECURITY: was missing any permission check even though it returns the full
// gateway `config` column — including the live WayForPay merchantSecretKey
// and Monobank API token. As a server action it's reachable directly over the
// network regardless of the admin page-level route guard, so anyone (no
// login required) could previously call this and read those secrets, which
// would let them forge valid WayForPay webhook signatures (mark any order
// "paid" for free) or call Monobank's API as the merchant.
const GATEWAY_SECRET_KEYS = ['merchantSecretKey', 'merchantPassword', 'token'] as const

export async function getGateways() {
  await assertPermission('payments')
  const rows = await db.select().from(paymentGateways).orderBy(paymentGateways.sortOrder)
  return rows.map((g) => {
    const raw = (g.config ?? {}) as Record<string, string>
    const cfg: Record<string, string> = { ...raw }
    const hasSecret: Record<string, boolean> = {}
    for (const key of GATEWAY_SECRET_KEYS) {
      hasSecret[key] = Boolean(raw[key])
      if (cfg[key]) cfg[key] = ''
    }
    return { ...g, config: cfg, hasSecret }
  })
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
    await assertWritePermission('payments')

    // Validate the Monobank acquiring token against the live API before
    // activating: a personal-API or mistyped token silently breaks checkout.
    const [existing] = await db
      .select({ config: paymentGateways.config })
      .from(paymentGateways)
      .where(eq(paymentGateways.code, code))
      .limit(1)
    const prev = (existing?.config ?? {}) as Record<string, string>
    const next = { ...data.config }
    for (const key of GATEWAY_SECRET_KEYS) {
      const incoming = String(next[key] ?? '').trim()
      if (incoming === '__CLEAR__') next[key] = ''
      else if (!incoming) next[key] = prev[key] ?? ''
    }

    let warning = ''
    // The stored token may be encrypted at rest (enc:v1:…) when the form was
    // saved without a new token — decrypt before the live check so Monobank
    // never receives ciphertext (which it would reject with 403, falsely
    // failing the save). Plaintext passes through unchanged.
    const effectiveToken = decryptConfigSecrets({ token: next.token }, ['token']).token
    if (code === 'monobank' && data.isActive && !data.isTestMode && effectiveToken) {
      try {
        const res = await fetch('https://api.monobank.ua/api/merchant/details', {
          headers: { 'X-Token': effectiveToken },
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

    // SECURITY: gateway credentials (Monobank token, WayForPay secret key)
    // are encrypted at rest — see lib/secrets.ts.
    await db
      .update(paymentGateways)
      .set({
        isActive: data.isActive,
        isTestMode: data.isTestMode,
        config: encryptConfigSecrets(next, GATEWAY_SECRET_KEYS),
        updatedAt: new Date(),
      })
      .where(eq(paymentGateways.code, code))
    revalidatePath('/admin/payments')
    revalidateTag(CACHE_TAGS.checkout, 'max')
    const tokenChecked = code === 'monobank' && data.isActive && !data.isTestMode && Boolean(next.token)
    const saved =
      tokenChecked
        ? `Настройки шлюза сохранены. Токен проверен${warning || ' — действителен'}`
        : 'Настройки шлюза сохранены'
    return { ok: true, message: saved }
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }
}

/* ------------------------------- Payments -------------------------------- */

export async function getPayments(params: PaymentPageParams = {}) {
  await assertPermission('payments')
  // Paginated list (was: unbounded select capped at 1000 rows — a heavy
  // payload once the table grows). Page/pageSize are clamped through the
  // shared list helper, so defaults and bounds match every other admin list.
  const { page, pageSize, offset, limit } = normalizePaymentPage(params)
  const [rows, totalRows] = await Promise.all([
    db.select().from(payments).orderBy(desc(payments.createdAt)).limit(limit).offset(offset),
    db.select({ value: count() }).from(payments),
  ])
  const total = totalRows[0]?.value ?? 0
  return { items: rows, total, page, pageSize, totalPages: totalPages(total, pageSize) }
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
  return `WFP-${Date.now()}-${randomInt(1000)}`
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
  await assertWritePermission('payments')
  const gateway = await getGateway(input.gatewayCode)
  if (!gateway) return { ok: false, message: 'Шлюз не найден' }
  if (!gateway.isActive) return { ok: false, message: 'Шлюз отключён. Активируйте его во вкладке «Шлюзы».' }
  // BUGFIX: Infinity passed the old check (!Infinity === false) and blew up
  // with a 500 on `toFixed`/numeric insert. Require a finite amount.
  if (!Number.isFinite(input.amount) || input.amount <= 0) return { ok: false, message: 'Укажите корректную сумму' }

  const orderReference = genOrderRef()
  // BUGFIX: gateway secrets are stored encrypted (updateGateway encrypts
  // them). Every other caller decrypts via decryptConfigSecrets — createPayment
  // used to pass the ciphertext (enc:v1:...) straight to the provider, so
  // manual invoice creation broke with an auth error after any settings save.
  const config = decryptConfigSecrets((gateway.config ?? {}) as Record<string, string>, GATEWAY_SECRET_KEYS)
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
  await assertWritePermission('payments')
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId))
  if (!payment) return { ok: false, message: 'Платёж не найден' }
  const gateway = await getGateway(payment.gatewayCode)
  if (!gateway) return { ok: false, message: 'Шлюз не найден' }
  const config = decryptConfigSecrets((gateway.config ?? {}) as Record<string, string>, GATEWAY_SECRET_KEYS)

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
    // Non-terminal gateway answers (Pending, RefundInProcessing, hold) must
    // not run settlePayment — that maps everything else to unpaid and would
    // wipe a paid/refunded order. logEvent above already recorded the probe.
    if (result.status === 'paid' || result.status === 'refunded') {
      await settlePayment(payment.orderReference, result.status, {
        eventType: 'status',
        amount: result.amount,
        raw: result.raw,
        message: result.message,
      })
    }
    revalidatePath('/admin/payments')
    revalidatePath('/admin/orders')
    return { ok: true, message: `Статус обновлён: ${result.status}` }
  }
  return { ok: false, message: result.message || 'Не удалось получить статус' }
}

/* ------------------------- Refund reserve ---------------------------- */

// A refund is a two-phase ledger write: the amount is first RESERVED in
// pending_refund_amount (visible in the admin list as "refund pending"),
// and only moved to refunded_amount/status after the gateway confirms.
// The old design wrote refunded_amount/status BEFORE the gateway call, so a
// crash between the reserve UPDATE and the gateway response left the payment
// showing as refunded with money never moved, and the retry blocked forever
// ("already fully refunded" / recompute from the poisoned amount).

/** CAS: move a pending refund reserve into confirmed refunded_amount/status. */
async function finalizeRefundReserve(
  paymentId: number,
  reservedAmount: number,
  newRefunded: number,
  status: 'refunded' | 'partially_refunded',
): Promise<boolean> {
  const res = await pool.query(
    `UPDATE payments
        SET refunded_amount = $2,
            status = $3,
            pending_refund_amount = 0,
            pending_refund_at = NULL,
            updated_at = NOW()
      WHERE id = $1 AND pending_refund_amount = $4
      RETURNING id`,
    [paymentId, newRefunded.toFixed(2), status, reservedAmount.toFixed(2)],
  )
  return (res.rowCount ?? 0) > 0
}

/** CAS: release a pending reserve without touching refunded_amount/status. */
async function clearRefundReserve(paymentId: number, reservedAmount: number): Promise<boolean> {
  const res = await pool.query(
    `UPDATE payments
        SET pending_refund_amount = 0,
            pending_refund_at = NULL,
            updated_at = NOW()
      WHERE id = $1 AND pending_refund_amount = $2
      RETURNING id`,
    [paymentId, reservedAmount.toFixed(2)],
  )
  return (res.rowCount ?? 0) > 0
}

/**
 * Order-side completion of a confirmed refund (gateway success, or a crashed
 * attempt completed by reconciliation): order paymentStatus, history, stock
 * restore and promo release for a full refund. All steps idempotent.
 */
async function completeRefundOrderSideEffects(
  payment: typeof payments.$inferSelect,
  refundAmount: number,
  planStatus: 'refunded' | 'partially_refunded',
): Promise<void> {
  const [linked] = await db
    .select({ id: orders.id, status: orders.status })
    .from(orders)
    .where(eq(orders.orderNumber, payment.orderReference))
    .limit(1)
  if (!linked) return
  await db
    .update(orders)
    .set({ paymentStatus: planStatus, updatedAt: new Date() })
    .where(eq(orders.id, linked.id))
  await db.insert(orderHistory).values({
    orderId: linked.id,
    type: 'payment',
    message: `Возврат ${refundAmount.toFixed(2)} ${payment.currency} выполнен через шлюз`,
    actor: 'Платёжный шлюз',
  })
  if (planStatus === 'refunded' && linked.status !== 'cancelled') {
    await restoreStockOnce(linked.id)
    // BUGFIX: a full refund voids the sale but used to keep the promo usage
    // counted against usageLimit. Release it so the code can be reused.
    // Partial refunds keep the usage: the order is still active.
    const { releasePromotionUsageForOrder } = await import('@/lib/shop/promo-usage')
    const { released } = await releasePromotionUsageForOrder(payment.orderReference)
    if (released.length > 0) {
      await db.insert(orderHistory).values({
        orderId: linked.id,
        type: 'note',
        message: `Использование промокода освобождено (полный возврат): ${released.map((r) => r.promoCode ?? `#${r.promotionId}`).join(', ')}`,
        actor: 'Платёжный шлюз',
      })
    }
  }
}

/**
 * Reconciles a pending refund reserve against the gateway (CHECK_STATUS).
 * A failed probe is 'unknown': the reserve stays and the admin checks the
 * gateway cabinet — never clear or finalize on an answer we didn't get.
 */
async function reconcilePendingRefundAtGateway(
  payment: typeof payments.$inferSelect,
  config: Record<string, string>,
): Promise<
  | { outcome: 'finalized'; newRefunded: number; status: 'refunded' | 'partially_refunded'; check: GatewayResult }
  | { outcome: 'cleared' }
  | { outcome: 'unknown' }
> {
  const pendingAmount = Number(payment.pendingRefundAmount ?? 0)
  let check: GatewayResult
  if (payment.gatewayCode === 'wayforpay') {
    check = await wayforpayCheckStatus(config, payment.orderReference)
  } else if (payment.gatewayCode === 'monobank') {
    if (!payment.invoiceId) return { outcome: 'unknown' }
    check = await monobankCheckStatus(config, payment.invoiceId)
  } else {
    return { outcome: 'unknown' }
  }
  if (!check.ok || !check.status) return { outcome: 'unknown' }
  const decision = reconcilePendingRefund({
    gatewayStatus: check.status,
    pendingAmount,
    alreadyRefunded: Number(payment.refundedAmount),
    total: Number(payment.amount),
  })
  if (decision.outcome === 'finalized') {
    const plan = refundPlan(Number(payment.amount), Number(payment.refundedAmount), pendingAmount)
    if (!plan.ok) return { outcome: 'unknown' }
    return { outcome: 'finalized', newRefunded: plan.newRefunded, status: plan.status, check }
  }
  return decision
}

export async function refundPayment(
  paymentId: number,
  amount?: number,
): Promise<ActionResult> {
  await assertWritePermission('payments')
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
  const config = decryptConfigSecrets((gateway.config ?? {}) as Record<string, string>, GATEWAY_SECRET_KEYS)

  const total = Number(payment.amount)
  const alreadyRefunded = Number(payment.refundedAmount)
  const pendingAmount = Number(payment.pendingRefundAmount ?? 0)

  // A reserve left by a crashed/ambiguous earlier attempt: reconcile it
  // against the gateway BEFORE trusting any local flag — otherwise the retry
  // is permanently blocked by the poisoned refunded_amount.
  if (pendingAmount > 0) {
    const reconciled = await reconcilePendingRefundAtGateway(payment, config)
    if (reconciled.outcome === 'unknown') {
      return {
        ok: false,
        ambiguous: true,
        message: `Возврат ${pendingAmount.toFixed(2)} ${payment.currency} уже ожидает подтверждения у шлюза. Проверьте в кабинете шлюза перед повтором — сумма зарезервирована и не может быть возвращена дважды.`,
      }
    }
    if (reconciled.outcome === 'finalized') {
      // The gateway confirms the refund executed — complete the crashed
      // attempt idempotently and report success instead of an error.
      const finalized = await finalizeRefundReserve(
        paymentId,
        pendingAmount,
        reconciled.newRefunded,
        reconciled.status,
      )
      if (finalized) {
        try {
          await logEvent(
            payment.id,
            'refund',
            {
              ok: true,
              status: 'refunded',
              refundedAmount: pendingAmount,
              message: 'Возврат підтверджено звіркою зі шлюзом після перерваної спроби',
              raw: reconciled.check.raw,
            },
            pendingAmount,
          )
        } catch (e) {
          console.error('[refundPayment] logEvent failed:', (e as Error).message, { paymentId })
        }
        revalidatePath('/admin/payments')
        await completeRefundOrderSideEffects(payment, pendingAmount, reconciled.status)
        return {
          ok: true,
          message: `Возврат ${pendingAmount.toFixed(2)} ${payment.currency} подтверждён у шлюза (завершена прерванная попытка)`,
        }
      }
      // Another retry finalized the same reserve concurrently — re-read and
      // report from the confirmed ledger instead of erroring.
      const [fresh] = await db.select().from(payments).where(eq(payments.id, paymentId))
      if (fresh && Number(fresh.refundedAmount) >= reconciled.newRefunded - 0.001) {
        revalidatePath('/admin/payments')
        await completeRefundOrderSideEffects(fresh, pendingAmount, reconciled.status)
        return {
          ok: true,
          message: `Возврат ${pendingAmount.toFixed(2)} ${payment.currency} подтверждён у шлюза (завершена прерванная попытка)`,
        }
      }
      return {
        ok: false,
        ambiguous: true,
        message: 'Не удалось завершить прерванный возврат в учёте — проверьте в кабинете шлюза перед повтором.',
      }
    }
    // 'cleared': the gateway proves the refund never executed — release the
    // reserve and proceed with a fresh attempt below.
    await clearRefundReserve(paymentId, pendingAmount)
  }

  const plan = refundPlan(total, alreadyRefunded, amount)
  if (!plan.ok) {
    return {
      ok: false,
      message:
        plan.error === 'exceeds'
          ? 'Сумма возврата превышает сумму платежа'
          : plan.error === 'invalid'
            ? 'Некорректная сумма возврата'
            : 'Нет доступной суммы для возврата',
    }
  }
  const refundAmount = plan.amount
  const newRefunded = plan.newRefunded

  // Reserve the refund in the pending marker BEFORE the gateway call. The
  // reserve is a CAS on (pending = 0, refunded_amount unchanged, status
  // payable): a concurrent refund loses the race and reports "already
  // processing", and a webhook refund that moved refunded_amount meanwhile
  // makes the reserve miss instead of planning from stale numbers.
  // refunded_amount/status change only after gateway success (finalize
  // below) — a reserved row that the gateway later rejects is simply
  // cleared, and a crashed attempt leaves a visible "refund pending"
  // marker that the next retry reconciles against the gateway.
  const reserved = await pool.query<{ id: number }>(
    `UPDATE payments
        SET pending_refund_amount = $2,
            pending_refund_at = NOW(),
            updated_at = NOW()
      WHERE id = $1
        AND pending_refund_amount = 0
        AND refunded_amount = $3
        AND status IN ('paid', 'partially_refunded')
      RETURNING id`,
    [paymentId, refundAmount.toFixed(2), alreadyRefunded.toFixed(2)],
  )
  if (!reserved.rowCount) {
    const [fresh] = await db.select().from(payments).where(eq(payments.id, paymentId))
    if (fresh?.status === 'refunded') {
      return { ok: false, message: 'Платёж уже полностью возвращён' }
    }
    return { ok: false, message: 'Возврат уже обрабатывается' }
  }

  // Versioned rollback: only clear the reserve if the row still holds
  // exactly the reserved amount, so a concurrent reconcile that already
  // finalized it is never clobbered.
  const rollbackReserve = async (): Promise<void> => {
    await clearRefundReserve(paymentId, refundAmount)
  }

  let result: GatewayResult
  try {
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
      if (!payment.invoiceId) {
        await rollbackReserve()
        return { ok: false, message: 'Отсутствует invoiceId' }
      }
      result = await monobankRefund(config, { invoiceId: payment.invoiceId, amount: refundAmount })
    } else {
      await rollbackReserve()
      return { ok: false, message: 'Неизвестный шлюз' }
    }
  } catch (e) {
    // The gateway call itself threw (network/timeout): the refund may or may
    // not have happened at the gateway — an ambiguous answer. Do NOT roll
    // back: retrying after a rollback could double-refund. The pending
    // reserve stays as the marker (visible in the admin list as "refund
    // pending"); the next retry reconciles it against the gateway first.
    return {
      ok: false,
      ambiguous: true,
      message: `Не удалось подтвердить статус возврата у шлюза (${(e as Error).message || 'ошибка соединения'}). Возврат, возможно, уже выполнен — сумма ${refundAmount.toFixed(2)} ${payment.currency} зарезервирована как ожидающая подтверждения, проверьте в кабинете шлюза перед повтором.`,
    }
  }

  // A logging failure must not drop the order-side updates after a
  // successful gateway refund — the money already moved.
  try {
    await logEvent(payment.id, 'refund', result, refundAmount)
  } catch (e) {
    console.error('[refundPayment] logEvent failed:', (e as Error).message, { paymentId })
  }

  if (!result.ok) {
    await rollbackReserve()
    return { ok: false, message: result.message || 'Ошибка возврата' }
  }

  // Gateway confirmed: move the reserve into the confirmed ledger. If a
  // concurrent retry already finalized the same reserve (reconcile path),
  // the ledger already holds the amount — verify and continue with the
  // order-side updates instead of failing a refund that succeeded.
  const finalized = await finalizeRefundReserve(paymentId, refundAmount, newRefunded, plan.status)
  if (!finalized) {
    const [fresh] = await db.select().from(payments).where(eq(payments.id, paymentId))
    if (!fresh || Number(fresh.refundedAmount) < newRefunded - 0.001) {
      return {
        ok: false,
        ambiguous: true,
        message: 'Возврат выполнен у шлюза, но не записан в учёт — проверьте в кабинете шлюза перед повтором.',
      }
    }
  }

  revalidatePath('/admin/payments')
  await completeRefundOrderSideEffects(payment, refundAmount, plan.status)
  return {
    ok: true,
    message: `Возврат ${refundAmount.toFixed(2)} ${payment.currency} выполнен`,
  }
}

/* ------------------------- Simulation (test mode) ------------------------ */

export async function markPaymentPaid(paymentId: number): Promise<ActionResult> {
  await assertWritePermission('payments')
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId))
  if (!payment) return { ok: false, message: 'Платёж не найден' }
  const gateway = await getGateway(payment.gatewayCode)
  if (!gateway?.isTestMode) {
    return { ok: false, message: 'Ручная отметка доступна только в тестовом режиме' }
  }
  // BUGFIX: used to stamp payments.status='paid' directly — the linked
  // storefront order stayed pending_payment (no stock deduction, no promo
  // accounting, no email, invisible in the buyer cabinet). Route through
  // settlePayment(), the single source of truth (idempotent for paid).
  const { settlePayment } = await import('@/lib/payments/settle')
  const res = await settlePayment(payment.orderReference, 'paid', {
    eventType: 'manual',
    message: 'Отмечено оплаченным вручную (тестовый режим)',
    amount: Number(payment.amount),
  })
  // settlePayment fails closed on amount mismatch — surface it honestly
  // instead of claiming success while the order stayed unpaid.
  if (res.matchedOrder) {
    const [o] = await db
      .select({ paymentStatus: orders.paymentStatus })
      .from(orders)
      .where(eq(orders.orderNumber, payment.orderReference))
    if (o && o.paymentStatus !== 'paid') {
      return { ok: false, message: 'Сумма платежа меньше итога заказа — отметка отклонена (см. историю заказа)' }
    }
  }
  revalidatePath('/admin/payments')
  return { ok: true, message: 'Платёж отмечен как оплаченный' }
}
