import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')
// Structural tests compare source text with LF literals; on Windows the
// checkout has CRLF line endings, so normalize here (Windows-only
// failure 11.11.2026: webhook-rate-limit-error-leak.test.ts:54).
const source = (file: string) => readFileSync(resolve(root, file), 'utf8').replace(/\r\n/g, '\n')

describe('LOW: WayForPay callback rate limit', () => {
  it('caps per-IP like the Monobank callback, before any verification', () => {
    const src = source('app/api/payments/wayforpay/callback/route.ts')
    // Same mechanism and same per-IP limits as the Monobank callback
    // (app/api/payments/monobank/callback/route.ts): 30/min per IP.
    expect(src).toContain("isRateLimited('wfp-webhook-ip', clientIp(req), 30, 60_000)")
    expect(src).toContain("from '@/lib/api/rate-limit'")
    expect(src).toContain('status: 429')
    // The check must run before the HMAC verification, not after it.
    expect(src.indexOf("isRateLimited('wfp-webhook-ip'")).toBeLessThan(
      src.indexOf('wayforpayVerifyCallback(secret, body)'),
    )
  })
})

describe('LOW: error responses do not leak internals', () => {
  it('admin upload returns only the generic message', () => {
    const src = source('app/api/admin/upload/route.ts')
    expect(src).toContain("error: 'Не удалось загрузить файл'")
    expect(src).not.toContain('Не удалось загрузить файл${detail}')
    expect(src).not.toContain('const detail =')
    // Full error still goes to the server log.
    expect(src).toContain("console.error('[v0] upload error:', error)")
  })

  it('createOrder returns a generic failure instead of rethrowing', () => {
    const src = source('app/actions/orders.ts')
    const start = src.indexOf('export async function createOrder(')
    const end = src.indexOf('export async function updateOrderStatus(')
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const fn = src.slice(start, end)
    expect(fn).not.toContain('throw e')
    expect(fn).toContain("'Не вдалося створити замовлення'")
    expect(fn).toContain("console.error('[orders] createOrder failed:', e)")
    // The specific-but-safe stock message is kept.
    expect(fn).toContain('Недостатньо залишку на складі')
  })
})

describe('wayforpayVerifyCallback: garbage status is never pending', () => {
  it('the route refuses to settle on an unknown status and logs it', () => {
    const src = source('app/api/payments/wayforpay/callback/route.ts')
    // The unknown-status guard must run before settlePayment, and the
    // settle call must no longer fall back to 'pending'.
    expect(src).toContain('if (result.status == null)')
    expect(src).toContain("reportError(\n      'payments.wayforpay-callback',")
    expect(src).toContain("error: 'unknown transaction status'")
    expect(src).not.toContain("result.status ?? 'pending'")
    expect(src.indexOf('if (result.status == null)')).toBeLessThan(
      src.indexOf('await settlePayment('),
    )
  })
})
