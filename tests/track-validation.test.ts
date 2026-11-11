import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isValidTrackPath, normalizeTrackReferrer } from '@/lib/analytics/track-validation'

vi.mock('@/lib/api/rate-limit', () => ({
  clientIp: vi.fn(() => '1.2.3.4'),
  isRateLimited: vi.fn(async () => false),
}))
vi.mock('@/app/actions/analytics', () => ({
  trackEvent: vi.fn(async () => ({ success: true })),
}))
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) =>
      Response.json(body as Record<string, unknown>, init),
  },
}))

import { POST } from '@/app/api/track/route'
import { trackEvent } from '@/app/actions/analytics'

const mockedTrack = vi.mocked(trackEvent)

const root = resolve(import.meta.dirname, '..')
// Structural tests compare source text with LF literals; normalize so the
// file also passes on a Windows CRLF checkout.
const source = (file: string) => readFileSync(resolve(root, file), 'utf8').replace(/\r\n/g, '\n')

function postEvent(body: Record<string, unknown>) {
  return POST(
    new Request('http://localhost/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }) as never,
  )
}

describe('isValidTrackPath', () => {
  it('accepts real shop pathnames', () => {
    expect(isValidTrackPath('/')).toBe(true)
    expect(isValidTrackPath('/product/some-slug')).toBe(true)
    expect(isValidTrackPath('/p/some-slug')).toBe(true)
    expect(isValidTrackPath('/catalog')).toBe(true)
    expect(isValidTrackPath('/checkout')).toBe(true)
  })

  it('rejects absolute URLs, garbage and protocol-relative paths', () => {
    expect(isValidTrackPath('https://evil.com/x')).toBe(false)
    expect(isValidTrackPath('http://evil.com')).toBe(false)
    expect(isValidTrackPath('evil.com/x')).toBe(false)
    expect(isValidTrackPath('product/x')).toBe(false)
    expect(isValidTrackPath('')).toBe(false)
    expect(isValidTrackPath('//evil.com/x')).toBe(false)
    expect(isValidTrackPath('javascript:alert(1)')).toBe(false)
  })
})

describe('normalizeTrackReferrer', () => {
  it('keeps a well-formed http(s) referrer', () => {
    expect(normalizeTrackReferrer('https://www.google.com/search?q=x')).toBe(
      'https://www.google.com/search?q=x',
    )
    expect(normalizeTrackReferrer('http://example.com/page')).toBe('http://example.com/page')
  })

  it('drops malformed and non-http(s) referrers', () => {
    expect(normalizeTrackReferrer('not a url')).toBeNull()
    expect(normalizeTrackReferrer('javascript:alert(1)')).toBeNull()
    expect(normalizeTrackReferrer('data:text/html,<h1>x</h1>')).toBeNull()
    expect(normalizeTrackReferrer('ftp://example.com/x')).toBeNull()
    expect(normalizeTrackReferrer('')).toBeNull()
    expect(normalizeTrackReferrer(undefined)).toBeNull()
    expect(normalizeTrackReferrer(123)).toBeNull()
  })

  it('caps a long referrer at 300 chars', () => {
    const long = `https://example.com/${'a'.repeat(400)}`
    const kept = normalizeTrackReferrer(long)
    expect(kept).not.toBeNull()
    expect(kept!.length).toBe(300)
  })
})

describe('POST /api/track path validation', () => {
  beforeEach(() => {
    mockedTrack.mockClear()
  })

  it('rejects a path not starting with / and never calls trackEvent', async () => {
    const res = await postEvent({ type: 'pageview', path: 'https://evil.com/x' })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ success: false })
    expect(mockedTrack).not.toHaveBeenCalled()
  })

  it('rejects a protocol-relative path', async () => {
    const res = await postEvent({ type: 'pageview', path: '//evil.com/x' })
    expect(res.status).toBe(400)
    expect(mockedTrack).not.toHaveBeenCalled()
  })

  it('accepts a shop pathname and forwards it to trackEvent', async () => {
    const res = await postEvent({ type: 'pageview', path: '/product/some-slug' })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true })
    expect(mockedTrack).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'pageview', path: '/product/some-slug' }),
    )
  })

  it('accepts an event without a path (e.g. add_to_cart)', async () => {
    const res = await postEvent({ type: 'add_to_cart', productId: 42 })
    expect(res.status).toBe(200)
    expect(mockedTrack).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'add_to_cart', path: undefined }),
    )
  })
})

describe('trackEvent wiring (audit: track/funnel, 3.4.96)', () => {
  it('validates the path in trackEvent too (defense in depth)', () => {
    const src = source('app/actions/analytics.ts')
    expect(src).toContain("!isValidTrackPath(input.path)")
  })

  it('normalizes the referrer in trackEvent instead of trusting it verbatim', () => {
    const src = source('app/actions/analytics.ts')
    expect(src).toContain('normalizeTrackReferrer(input.referrer)')
    expect(src).not.toContain("input.referrer.slice(0, 300)")
  })

  it('keeps the existing rate limits and event-type whitelist unchanged', () => {
    const src = source('app/actions/analytics.ts')
    expect(src).toContain("isRateLimited('analytics-track', ip, 120)")
    expect(src).toContain("new Set(['pageview', 'product_view', 'add_to_cart'])")
    expect(source('app/api/track/route.ts')).toContain(
      "isRateLimited('track', ip, 60, 60_000",
    )
  })
})

describe('statsApproximateNote (audit: track/funnel, 3.4.96)', () => {
  it('exists in the statistics section: type, uk and ru', () => {
    const src = source('lib/i18n/admin/dictionaries.ts')
    expect(src).toContain('statsApproximateNote: string')
    expect(src).toContain(
      'Орієнтовно: трафік, воронка та конверсія рахуються з подій браузера і не є перевіреними даними.',
    )
    expect(src).toContain(
      'Ориентировочно: трафик, воронка и конверсия считаются по событиям браузера и не являются проверенными данными.',
    )
  })

  it('renders in the funnel card, under the conversion percentages', () => {
    const src = source('components/statistics/stats-dashboard.tsx')
    const funnelCard = src.slice(src.indexOf('funnelTitle'), src.indexOf('orderStatusesTitle'))
    expect(funnelCard).toContain('t.statistics.statsApproximateNote')
    // Visible line with a tooltip, next to the conversion percentages.
    expect(funnelCard).toContain('conversionOverallPrefix')
    expect(funnelCard).toContain('title={t.statistics.statsApproximateNote}')
  })
})
