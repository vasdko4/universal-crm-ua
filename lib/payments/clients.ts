import crypto from 'crypto'

export type GatewayResult = {
  ok: boolean
  status?: string
  invoiceId?: string
  paymentUrl?: string
  refundedAmount?: number
  message?: string
  raw?: unknown
}

const CURRENCY_CODES: Record<string, number> = {
  UAH: 980,
  USD: 840,
  EUR: 978,
}

/* ------------------------------- WayForPay -------------------------------- */

type WayForPayConfig = {
  merchantAccount?: string
  merchantSecretKey?: string
  merchantDomainName?: string
  // Optional. Not part of the payment API signature; kept for account-level ops.
  merchantPassword?: string
}

// WayForPay transactionStatus -> internal status. Shared by CHECK_STATUS and webhook.
const WFP_STATUS_MAP: Record<string, string> = {
  Approved: 'paid',
  Pending: 'pending',
  InProcessing: 'pending',
  WaitingAuthComplete: 'pending',
  Declined: 'failed',
  Refunded: 'refunded',
  Voided: 'refunded',
  Expired: 'expired',
  RefundInProcessing: 'pending',
}

const WFP_API = 'https://api.wayforpay.com/api'

function wfpSignature(secret: string, fields: (string | number)[]): string {
  return crypto
    .createHmac('md5', secret)
    .update(fields.join(';'), 'utf8')
    .digest('hex')
}

async function wfpRequest(body: Record<string, unknown>): Promise<any> {
  const res = await fetch(WFP_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

export async function wayforpayCreateInvoice(
  config: WayForPayConfig,
  params: {
    orderReference: string
    amount: number
    currency: string
    productName: string
    clientEmail?: string
    clientPhone?: string
    // Server-to-server callback endpoint (WayForPay "Service URL").
    serviceUrl?: string
    // Browser redirect target after payment (WayForPay "returnUrl"/approvedUrl).
    returnUrl?: string
  },
): Promise<GatewayResult> {
  const { merchantAccount, merchantSecretKey, merchantDomainName } = config
  if (!merchantAccount || !merchantSecretKey || !merchantDomainName) {
    return { ok: false, message: 'WayForPay: не заполнены учётные данные шлюза' }
  }
  const orderDate = Math.floor(Date.now() / 1000)
  const amount = Number(params.amount.toFixed(2))
  const productName = [params.productName]
  const productCount = [1]
  const productPrice = [amount]

  const signature = wfpSignature(merchantSecretKey, [
    merchantAccount,
    merchantDomainName,
    params.orderReference,
    orderDate,
    amount,
    params.currency,
    ...productName,
    ...productCount,
    ...productPrice,
  ])

  const body = {
    transactionType: 'CREATE_INVOICE',
    merchantAccount,
    merchantAuthType: 'SimpleSignature',
    merchantDomainName,
    merchantSignature: signature,
    apiVersion: 1,
    orderReference: params.orderReference,
    orderDate,
    amount,
    currency: params.currency,
    productName,
    productCount,
    productPrice,
    clientEmail: params.clientEmail || undefined,
    clientPhone: params.clientPhone || undefined,
    // serviceUrl/returnUrl are NOT part of the merchantSignature hash.
    serviceUrl: params.serviceUrl || undefined,
    returnUrl: params.returnUrl || undefined,
    language: 'UA',
  }

  try {
    const data = await wfpRequest(body)
    if (data?.reason === 'Ok' || data?.reasonCode === 1100 || data?.invoiceUrl) {
      return {
        ok: true,
        status: 'pending',
        paymentUrl: data.invoiceUrl,
        message: 'Счёт создан',
        raw: data,
      }
    }
    return { ok: false, message: data?.reason || 'Ошибка создания счёта', raw: data }
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }
}

export async function wayforpayCheckStatus(
  config: WayForPayConfig,
  orderReference: string,
): Promise<GatewayResult> {
  const { merchantAccount, merchantSecretKey } = config
  if (!merchantAccount || !merchantSecretKey) {
    return { ok: false, message: 'WayForPay: не заполнены учётные данные шлюза' }
  }
  const signature = wfpSignature(merchantSecretKey, [merchantAccount, orderReference])
  try {
    const data = await wfpRequest({
      transactionType: 'CHECK_STATUS',
      merchantAccount,
      orderReference,
      merchantSignature: signature,
      apiVersion: 1,
    })
    return {
      ok: true,
      status: WFP_STATUS_MAP[data?.transactionStatus] || 'pending',
      message: data?.transactionStatus,
      raw: data,
    }
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }
}

export async function wayforpayRefund(
  config: WayForPayConfig,
  params: { orderReference: string; amount: number; currency: string; comment?: string },
): Promise<GatewayResult> {
  const { merchantAccount, merchantSecretKey } = config
  if (!merchantAccount || !merchantSecretKey) {
    return { ok: false, message: 'WayForPay: не заполнены учётные данные шлюза' }
  }
  const amount = Number(params.amount.toFixed(2))
  const signature = wfpSignature(merchantSecretKey, [
    merchantAccount,
    params.orderReference,
    amount,
    params.currency,
  ])
  try {
    const data = await wfpRequest({
      transactionType: 'REFUND',
      merchantAccount,
      orderReference: params.orderReference,
      amount,
      currency: params.currency,
      comment: params.comment || 'Возврат средств',
      merchantSignature: signature,
      apiVersion: 1,
    })
    const okCodes = [1100, 4014] // Ok / RefundInProcessing
    if (okCodes.includes(data?.reasonCode) || data?.reason === 'Ok') {
      return {
        ok: true,
        status: 'refunded',
        refundedAmount: amount,
        message: data?.reason || 'Возврат выполнен',
        raw: data,
      }
    }
    return { ok: false, message: data?.reason || 'Ошибка возврата', raw: data }
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }
}

export type WayForPayCallback = {
  valid: boolean
  orderReference?: string
  status?: string
  transactionStatus?: string
  amount?: number
  currency?: string
  raw: Record<string, unknown>
}

// Verifies the merchantSignature WayForPay sends to the Service URL and maps
// the transaction status to our internal status. Never trust an unverified body.
export function wayforpayVerifyCallback(
  secret: string,
  body: Record<string, unknown>,
): WayForPayCallback {
  const s = (k: string) => (body[k] == null ? '' : String(body[k]))
  const expected = wfpSignature(secret, [
    s('merchantAccount'),
    s('orderReference'),
    s('amount'),
    s('currency'),
    s('authCode'),
    s('cardPan'),
    s('transactionStatus'),
    s('reasonCode'),
  ])
  const valid = expected === s('merchantSignature')
  return {
    valid,
    orderReference: s('orderReference') || undefined,
    transactionStatus: s('transactionStatus') || undefined,
    status: WFP_STATUS_MAP[s('transactionStatus')] || 'pending',
    amount: body.amount != null ? Number(body.amount) : undefined,
    currency: s('currency') || undefined,
    raw: body,
  }
}

// Builds the mandatory acknowledgment WayForPay expects in the webhook response.
export function wayforpayCallbackResponse(secret: string, orderReference: string) {
  const time = Math.floor(Date.now() / 1000)
  const status = 'accept'
  const signature = wfpSignature(secret, [orderReference, status, time])
  return { orderReference, status, time, signature }
}

/* -------------------------------- Monobank -------------------------------- */

type MonobankConfig = { token?: string }
const MONO_API = 'https://api.monobank.ua/api/merchant'

async function monoRequest(
  token: string,
  path: string,
  method: 'GET' | 'POST',
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; data: any; httpStatus: number }> {
  const res = await fetch(`${MONO_API}${path}`, {
    method,
    headers: {
      'X-Token': token,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, data, httpStatus: res.status }
}

export async function monobankCreateInvoice(
  config: MonobankConfig,
  params: {
    orderReference: string
    amount: number
    currency: string
    description: string
    redirectUrl?: string
    webHookUrl?: string
  },
): Promise<GatewayResult> {
  if (!config.token) {
    return { ok: false, message: 'Monobank: не указан токен эквайринга' }
  }
  const ccy = CURRENCY_CODES[params.currency] ?? 980
  const body = {
    amount: Math.round(params.amount * 100),
    ccy,
    merchantPaymInfo: {
      reference: params.orderReference,
      destination: params.description,
    },
    redirectUrl: params.redirectUrl || undefined,
    webHookUrl: params.webHookUrl || undefined,
    validity: 3600,
  }
  try {
    const { ok, data } = await monoRequest(config.token, '/invoice/create', 'POST', body)
    if (ok && data?.invoiceId) {
      return {
        ok: true,
        status: 'pending',
        invoiceId: data.invoiceId,
        paymentUrl: data.pageUrl,
        message: 'Счёт создан',
        raw: data,
      }
    }
    return { ok: false, message: data?.errText || 'Ошибка создания счёта', raw: data }
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }
}

export async function monobankCheckStatus(
  config: MonobankConfig,
  invoiceId: string,
): Promise<GatewayResult> {
  if (!config.token) return { ok: false, message: 'Monobank: не указан токен эквайринга' }
  try {
    const { ok, data } = await monoRequest(
      config.token,
      `/invoice/status?invoiceId=${encodeURIComponent(invoiceId)}`,
      'GET',
    )
    if (!ok) return { ok: false, message: data?.errText || 'Ошибка запроса статуса', raw: data }
    const map: Record<string, string> = {
      created: 'pending',
      processing: 'pending',
      hold: 'pending',
      success: 'paid',
      failure: 'failed',
      reversed: 'refunded',
      expired: 'expired',
    }
    return {
      ok: true,
      status: map[data?.status] || 'pending',
      message: data?.status,
      raw: data,
    }
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }
}

export async function monobankRefund(
  config: MonobankConfig,
  params: { invoiceId: string; amount: number },
): Promise<GatewayResult> {
  if (!config.token) return { ok: false, message: 'Monobank: не указан токен эквайринга' }
  const body = {
    invoiceId: params.invoiceId,
    amount: Math.round(params.amount * 100),
  }
  try {
    const { ok, data } = await monoRequest(config.token, '/invoice/cancel', 'POST', body)
    if (ok && (data?.status === 'processing' || data?.status === 'success')) {
      return {
        ok: true,
        status: 'refunded',
        refundedAmount: params.amount,
        message: data?.status,
        raw: data,
      }
    }
    return { ok: false, message: data?.errText || 'Ошибка возврата', raw: data }
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }
}
