import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { paymentGateways } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { wayforpayVerifyCallback, wayforpayCallbackResponse } from '@/lib/payments/clients'
import { isRateLimited, clientIp } from '@/lib/api/rate-limit'
import { settlePayment } from '@/lib/payments/settle'
import { decryptSecret } from '@/lib/secrets'
import { reportError } from '@/lib/server-errors'

export const dynamic = 'force-dynamic'

// Browsers may land here with GET if the merchant cabinet mistakenly uses the
// Service URL as approvedUrl/declinedUrl. Forward the shopper to the proper
// return page instead of showing a 404.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const orderRef = url.searchParams.get('orderReference') || url.searchParams.get('order')
  return redirectToReturn(req, orderRef ?? '')
}

// 303 turns the browser's POST navigation into a GET on the return page.
function redirectToReturn(req: Request, orderReference: string) {
  const target = new URL('/checkout/return', new URL(req.url).origin)
  if (orderReference) target.searchParams.set('orderReference', orderReference)
  return NextResponse.redirect(target, 303)
}

// WayForPay redirects the shopper's browser to returnUrl with a POST. If the
// merchant cabinet points approvedUrl/declinedUrl here, the browser arrives as
// a POST navigation — detect it and forward to the proper return page.
function isBrowserNavigation(req: Request): boolean {
  const accept = req.headers.get('accept') ?? ''
  const fetchMode = req.headers.get('sec-fetch-mode') ?? ''
  return accept.includes('text/html') || fetchMode === 'navigate'
}

// WayForPay "Service URL": server-to-server payment notifications.
// We verify the signature, sync the order/payment, then return the mandatory
// signed acknowledgment so WayForPay stops retrying.
export async function POST(req: Request) {
  // Unauthenticated callback: each call costs a 0.3-0.5s HMAC verification,
  // so an unauthenticated replay is a trivial CPU DoS. Cap per-IP like the
  // Monobank callback (30/min) and refuse BEFORE any verification runs —
  // a genuine callback is retried by WayForPay.
  if (await isRateLimited('wfp-webhook-ip', clientIp(req), 30, 60_000)) {
    return NextResponse.json({ error: 'too many requests' }, { status: 429 })
  }

  // WayForPay may send raw JSON, or form-encoded where the whole JSON is a key.
  let body: Record<string, unknown> = {}
  try {
    // Callbacks are small JSON payloads — reject absurd bodies BEFORE
    // buffering them (req.text() was unbounded before the signature check).
    const MAX_CALLBACK_BYTES = 64 * 1024
    const contentLength = Number(req.headers.get('content-length'))
    if (Number.isFinite(contentLength) && contentLength > MAX_CALLBACK_BYTES) {
      return NextResponse.json({ error: 'payload too large' }, { status: 413 })
    }
    const raw = await req.text()
    if (raw.length > MAX_CALLBACK_BYTES) {
      return NextResponse.json({ error: 'payload too large' }, { status: 413 })
    }
    try {
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return NextResponse.json({ error: 'bad request' }, { status: 400 })
      }
      body = parsed as Record<string, unknown>
    } catch {
      const params = new URLSearchParams(raw)
      const first = [...params.keys()][0]
      if (first) {
        try {
          const nested = JSON.parse(first)
          if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
            body = nested as Record<string, unknown>
          } else {
            body = Object.fromEntries(params.entries())
          }
        } catch {
          body = Object.fromEntries(params.entries())
        }
      }
    }
  } catch {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }

  // A shopper's browser posting here (redirect from the hosted payment page)
  // must never see raw JSON — send them to the return page instead. The order
  // status itself is settled by the genuine server-to-server Service URL call.
  const browserNav = isBrowserNavigation(req)
  const bodyOrderRef = typeof body.orderReference === 'string' ? body.orderReference : ''

  const [gateway] = await db
    .select()
    .from(paymentGateways)
    .where(eq(paymentGateways.code, 'wayforpay'))
    .limit(1)
  // The secret key is stored encrypted at rest (lib/secrets.ts).
  const secret = decryptSecret(((gateway?.config ?? {}) as Record<string, string>).merchantSecretKey)
  if (!secret) {
    if (browserNav) return redirectToReturn(req, bodyOrderRef)
    return NextResponse.json({ error: 'gateway not configured' }, { status: 400 })
  }

  const result = wayforpayVerifyCallback(secret, body)
  if (!result.valid || !result.orderReference) {
    if (browserNav) return redirectToReturn(req, bodyOrderRef)
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }

  // An unknown transactionStatus is never a legitimate 'pending' — do not
  // settle it and do not ack: WayForPay retries the callback, and a retry
  // carrying a known status settles normally. Log it for the admin.
  if (result.status == null) {
    if (browserNav) return redirectToReturn(req, result.orderReference)
    await reportError(
      'payments.wayforpay-callback',
      new Error(
        `Unknown WayForPay transactionStatus ${result.transactionStatus ?? '(missing)'} for order ${result.orderReference}`,
      ),
      { alertAdmin: true },
    )
    return NextResponse.json({ error: 'unknown transaction status' }, { status: 400 })
  }

  await settlePayment(result.orderReference, result.status, {
    eventType: 'webhook',
    message: `WayForPay: ${result.transactionStatus ?? result.status}`,
    amount: result.amount,
    raw: result.raw,
  })

  if (browserNav) return redirectToReturn(req, result.orderReference)

  // Acknowledge with the signed response WayForPay requires.
  return NextResponse.json(wayforpayCallbackResponse(secret, result.orderReference))
}
