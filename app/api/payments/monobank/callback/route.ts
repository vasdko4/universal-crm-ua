import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { paymentGateways, payments } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { monobankCheckStatus } from '@/lib/payments/clients'
import { settlePayment } from '@/lib/payments/settle'
import { readJson } from '@/lib/api/helpers'
import { isRateLimited, clientIp } from '@/lib/api/rate-limit'

export const dynamic = 'force-dynamic'

// Browsers may land here with GET if the webhook URL is mistakenly used as a
// redirect URL. Forward the shopper to the proper return page instead of 404.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const orderRef = url.searchParams.get('orderReference') || url.searchParams.get('order')
  const target = new URL('/checkout/return', url.origin)
  if (orderRef) target.searchParams.set('orderReference', orderRef)
  return NextResponse.redirect(target, 302)
}

// Monobank Acquiring webhook. Rather than validating the ECDSA X-Sign header,
// we treat the notification as a trigger and re-fetch the authoritative status
// from Monobank's API using our secret token before settling anything.
export async function POST(req: Request) {
  const body = await readJson<Record<string, unknown>>(req)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }

  const invoiceId = typeof body.invoiceId === 'string' || typeof body.invoiceId === 'number'
    ? String(body.invoiceId).trim().slice(0, 100)
    : ''
  if (!invoiceId || !/^[\w.-]+$/.test(invoiceId)) {
    return NextResponse.json({ error: 'no invoiceId' }, { status: 400 })
  }

  // invoiceId is public (it sits in the checkout URL). Without a signature
  // check, anyone who saw it can force us to hit Monobank's API on a loop.
  // Cap per-invoice and per-IP so a replay cannot burn the merchant quota.
  if (
    (await isRateLimited('mono-webhook', invoiceId, 8, 60_000)) ||
    (await isRateLimited('mono-webhook-ip', clientIp(req), 30, 60_000))
  ) {
    return NextResponse.json({ ok: true, note: 'rate limited' })
  }

  const [gateway] = await db
    .select()
    .from(paymentGateways)
    .where(eq(paymentGateways.code, 'monobank'))
    .limit(1)
  const token = ((gateway?.config ?? {}) as Record<string, string>).token
  if (!token) return NextResponse.json({ error: 'gateway not configured' }, { status: 400 })

  // Find our payment by invoiceId to resolve the orderReference.
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, invoiceId))
    .limit(1)
  if (!payment) return NextResponse.json({ ok: true, note: 'unknown invoice' })

  const status = await monobankCheckStatus({ token }, invoiceId)
  if (status.ok && status.status) {
    await settlePayment(payment.orderReference, status.status, {
      eventType: 'webhook',
      message: `Monobank: ${status.message ?? status.status}`,
      amount: status.amount,
      raw: status.raw,
    })
  }
  return NextResponse.json({ ok: true })
}
