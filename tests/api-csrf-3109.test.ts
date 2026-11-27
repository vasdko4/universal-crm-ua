import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, afterEach } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const source = (file: string) => readFileSync(resolve(root, file), 'utf8')

import { csrfCheck, isAllowedOrigin } from '@/lib/api/csrf'

function post(url: string, origin?: string): Request {
  return new Request(url, {
    method: 'POST',
    headers: origin ? { Origin: origin } : {},
  })
}

const savedEnv: Record<string, string | undefined> = {}
function setEnv(key: string, value: string | undefined) {
  if (!(key in savedEnv)) savedEnv[key] = process.env[key]
  if (value === undefined) delete process.env[key]
  else process.env[key] = value
}
afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  for (const key of Object.keys(savedEnv)) delete savedEnv[key]
  // Configured origins must not leak between tests.
  delete process.env.BETTER_AUTH_URL
  delete process.env.APP_URL
  delete process.env.V0_RUNTIME_URL
  delete process.env.VERCEL
  delete process.env.VERCEL_URL
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL
  delete process.env.VERCEL_BRANCH_URL
})

// Audit #5 (3.4.109): Origin check — no-Origin allowed, same-origin /
// configured origins allowed, anything else 403.
describe('csrfCheck', () => {
  it('allows requests without an Origin header (curl, Android app, server-to-server)', () => {
    expect(csrfCheck(post('https://shop.test/api/orders/1/message'))).toBeNull()
  })

  it('allows a same-origin Origin', () => {
    expect(
      csrfCheck(post('https://shop.test/api/orders/1/message', 'https://shop.test')),
    ).toBeNull()
  })

  it('rejects a foreign Origin with 403', async () => {
    const res = csrfCheck(post('https://shop.test/api/orders/1/message', 'https://evil.test'))
    expect(res).not.toBeNull()
    expect(res!.status).toBe(403)
    expect(await res!.json()).toMatchObject({ error: expect.any(String) })
  })

  it('rejects a malformed Origin with 403', () => {
    const res = csrfCheck(post('https://shop.test/api/orders/1/message', 'not-a-url'))
    expect(res).not.toBeNull()
    expect(res!.status).toBe(403)
  })

  it('allows the configured public origin behind a proxy (req.url is internal)', () => {
    setEnv('BETTER_AUTH_URL', 'https://shop.test')
    // Internal origin differs from the public one — the proxy case.
    expect(
      csrfCheck(post('http://127.0.0.1:3000/api/orders/1/message', 'https://shop.test')),
    ).toBeNull()
  })

  it('still rejects a foreign Origin when a public origin is configured', () => {
    setEnv('BETTER_AUTH_URL', 'https://shop.test')
    expect(
      csrfCheck(post('http://127.0.0.1:3000/api/orders/1/message', 'https://evil.test')),
    )?.not.toBeNull()
  })

  it('allows a V0 preview subdomain when V0_RUNTIME_URL is set', () => {
    setEnv('V0_RUNTIME_URL', 'https://shop-abc123.vusercontent.net')
    expect(
      isAllowedOrigin('https://other-xyz.vusercontent.net', 'https://shop-abc123.vusercontent.net'),
    ).toBe(true)
    expect(
      isAllowedOrigin('https://evil.test', 'https://shop-abc123.vusercontent.net'),
    ).toBe(false)
  })
})

describe('CSRF wiring: order message route (audit #5 + #10)', () => {
  const src = source('app/api/orders/[id]/message/route.ts')

  it('checks CSRF first, before auth and any DB work', () => {
    expect(src).toContain("import { csrfCheck } from '@/lib/api/csrf'")
    const csrfAt = src.indexOf('csrfCheck(req)')
    expect(csrfAt).toBeGreaterThan(-1)
    expect(csrfAt).toBeLessThan(src.indexOf('await getAdminUserWithWritePermission'))
    expect(src).toContain('if (csrf) return csrf')
  })

  it('validates kind/channel with 400 on unknown values', () => {
    expect(src).toContain('isValidOrderMessageKind')
    expect(src).toContain('isValidOrderMessageChannel')
    expect(src).toContain("Невідомий тип повідомлення")
    expect(src).toContain("Невідомий канал повідомлення")
    expect(src).toContain('{ status: 400 }')
  })

  it('rate-limits 5/hour per admin+order with 429', () => {
    expect(src).toContain("isRateLimited('order-message'")
    expect(src).toContain('`${me.id}:${orderId}`')
    expect(src).toContain('3_600_000')
    expect(src).toContain('{ status: 429 }')
  })
})

describe('CSRF exclusions (deliberate, audit #5)', () => {
  it('Better Auth keeps its own trustedOrigins — no csrfCheck in the auth route', () => {
    expect(source('app/api/auth/[...all]/route.ts')).not.toContain('csrfCheck')
  })

  it('signed payment callbacks have no cookie auth — no csrfCheck', () => {
    expect(source('app/api/payments/monobank/callback/route.ts')).not.toContain('csrfCheck')
    expect(source('app/api/payments/wayforpay/callback/route.ts')).not.toContain('csrfCheck')
    // The WayForPay return path only resolves + 303-redirects (GET in the
    // callback route); its POST is the signed server-to-server callback.
    expect(source('app/api/payments/wayforpay/callback/route.ts')).toContain('303')
  })

  it('cron routes are GET-only + CRON_SECRET — no csrfCheck', () => {
    for (const id of [
      'analytics-retention',
      'anomaly-alert',
      'db-backup',
      'delivery-sync',
      'expire-pending',
      'notification-retry',
      'prom-sync',
    ]) {
      expect(source(`app/api/cron/${id}/route.ts`)).not.toContain('csrfCheck')
    }
  })
})
