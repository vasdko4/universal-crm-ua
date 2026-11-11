import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
// Structural tests compare source text with LF literals; normalize CRLF so
// they also pass on a Windows checkout (see the CRLF fix, 11.11.2026).
const source = (file: string) => readFileSync(resolve(root, file), 'utf8').replace(/\r\n/g, '\n')

describe('audit lookup limiter (3.4.96): guest order lookup uses the shared limiter', () => {
  const shop = source('app/actions/shop.ts')

  it('the unbounded in-process Map and its helper are gone', () => {
    expect(shop).not.toContain('orderLookupHits')
    expect(shop).not.toContain('isOrderLookupRateLimited')
    expect(shop).not.toContain('ORDER_LOOKUP_WINDOW_MS')
    expect(shop).not.toContain('ORDER_LOOKUP_MAX_PER_WINDOW')
  })

  it('getOrderByNumber rate-limits via isRateLimited with scope order-lookup, max 20', () => {
    expect(shop).toContain("isRateLimited('order-lookup', await actionClientIp(), 20)")
  })

  it('the limit keeps the old 20-per-minute shape (default 60s window)', () => {
    // isRateLimited defaults windowMs to 60_000; the call passes no window,
    // so the effective limit is 20/min — the same as the old Map's
    // 20 per 60_000 ms window.
    expect(shop).toContain("isRateLimited('order-lookup', await actionClientIp(), 20)")
    const limiter = source('lib/api/rate-limit.ts')
    expect(limiter).toContain('windowMs = 60_000')
  })

  it('clientIpFromHeaders is still used by actionClientIp and the feedback limiter', () => {
    expect(shop).toContain('clientIpFromHeaders')
    expect(shop).toContain('async function actionClientIp()')
    expect(shop).toContain('isFeedbackRateLimited')
  })
})

describe('audit lookup limiter (3.4.96): expired rate_limits rows are pruned', () => {
  const route = source('app/api/cron/analytics-retention/route.ts')

  it('deletes rate_limits rows whose window expired over a day ago', () => {
    expect(route).toContain('DELETE FROM rate_limits')
    expect(route).toContain("reset_at < NOW() - ($1::text || ' days')::interval")
    expect(route).toContain('RATE_LIMITS_RETENTION_DAYS = 1')
  })

  it('reports the pruned count in the response', () => {
    expect(route).toContain('deletedRateLimits')
  })

  it('the limiter reuses expired keys, so the prune cannot break a live bucket', () => {
    // postgresLimited upserts: an expired key resets to count 1 with a fresh
    // window. The prune only removes rows a full day past reset_at — far
    // beyond any window in use — so it never deletes a bucket a request
    // could still be counting against.
    const limiter = source('lib/api/rate-limit.ts')
    expect(limiter).toContain('ON CONFLICT (key) DO UPDATE')
    expect(limiter).toContain('WHEN rate_limits.reset_at <= NOW() THEN 1')
  })
})
