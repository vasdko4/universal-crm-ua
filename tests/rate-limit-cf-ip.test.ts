import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { clientIpFromHeaders } from '@/lib/api/rate-limit'

function headersMap(entries: Record<string, string>) {
  const lower = new Map(
    Object.entries(entries).map(([k, v]) => [k.toLowerCase(), v]),
  )
  return { get: (name: string) => lower.get(name.toLowerCase()) ?? null }
}

// The suite runs off Vercel by default; the Vercel branch is enabled
// explicitly per test via stubEnv.
beforeEach(() => {
  vi.stubEnv('VERCEL', '')
  vi.stubEnv('TRUSTED_PROXIES', '')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('clientIpFromHeaders behind Cloudflare (3.4.107 fix 1)', () => {
  it('returns the client when the last XFF hop is a real Cloudflare edge', () => {
    const h = headersMap({
      'x-forwarded-for': '203.0.113.5, 172.67.1.1',
    })
    expect(clientIpFromHeaders(h)).toBe('203.0.113.5')
  })

  it('ignores cf-connecting-ip even when cf-ray is present', () => {
    const h = headersMap({
      'cf-ray': '8a1b2c3d4e5f6a7b-KBP',
      'cf-connecting-ip': '1.2.3.4',
      'x-forwarded-for': '5.6.7.8, 172.67.1.1',
    })
    // cf-ray proves nothing — it is just another client-sent header.
    expect(clientIpFromHeaders(h)).toBe('5.6.7.8')
  })

  it('ignores a directly-sent cf-connecting-ip with no XFF at all', () => {
    const h = headersMap({
      'cf-ray': '8a1b2c3d4e5f6a7b-KBP',
      'cf-connecting-ip': '1.2.3.4',
    })
    expect(clientIpFromHeaders(h)).toBe('unknown')
  })

  it('does not let cf-connecting-ip override the XFF walk', () => {
    const h = headersMap({
      'cf-connecting-ip': '1.2.3.4',
      'x-forwarded-for': '5.6.7.8, 203.0.113.9',
    })
    expect(clientIpFromHeaders(h)).toBe('203.0.113.9')
  })

  it('returns unknown when every XFF hop is a trusted proxy', () => {
    // A lone Cloudflare edge IP vouches for no client — it must not
    // become the shared rate-limit bucket for all visitors.
    expect(clientIpFromHeaders(headersMap({ 'x-forwarded-for': '172.67.1.1' }))).toBe(
      'unknown',
    )
    expect(
      clientIpFromHeaders(headersMap({ 'x-forwarded-for': '127.0.0.1' })),
    ).toBe('unknown')
  })

  it('skips several trusted hops from the right', () => {
    const h = headersMap({
      'x-forwarded-for': '203.0.113.5, 172.67.1.1, 104.16.0.99',
    })
    expect(clientIpFromHeaders(h)).toBe('203.0.113.5')
  })

  it('never trusts x-real-ip', () => {
    expect(clientIpFromHeaders(headersMap({ 'x-real-ip': '9.9.9.9' }))).toBe('unknown')
    expect(
      clientIpFromHeaders(
        headersMap({ 'x-real-ip': '9.9.9.9', 'x-forwarded-for': '1.1.1.1, 10.0.0.1' }),
      ),
    ).toBe('10.0.0.1')
  })

  it('returns unknown on a garbage hop instead of keying on attacker text', () => {
    expect(
      clientIpFromHeaders(headersMap({ 'x-forwarded-for': '8.8.8.8, not-an-ip' })),
    ).toBe('unknown')
    expect(clientIpFromHeaders(headersMap({}))).toBe('unknown')
  })

  it('Vercel branch untouched: x-vercel-forwarded-for only on Vercel', () => {
    vi.stubEnv('VERCEL', '1')
    expect(
      clientIpFromHeaders(
        headersMap({
          'x-vercel-forwarded-for': '10.0.0.1',
          'x-real-ip': '10.0.0.2',
          'x-forwarded-for': '10.0.0.3, 10.0.0.4',
        }),
      ),
    ).toBe('10.0.0.1')
    vi.stubEnv('VERCEL', '')
    expect(
      clientIpFromHeaders(
        headersMap({
          'x-vercel-forwarded-for': '10.0.0.1',
          'x-real-ip': '10.0.0.2',
          'x-forwarded-for': '10.0.0.3, 10.0.0.4',
        }),
      ),
    ).toBe('10.0.0.4')
  })

  it('honours the TRUSTED_PROXIES override when walking XFF', () => {
    vi.stubEnv('TRUSTED_PROXIES', '203.0.113.0/24')
    expect(
      clientIpFromHeaders(
        headersMap({ 'x-forwarded-for': '198.51.100.7, 203.0.113.9' }),
      ),
    ).toBe('198.51.100.7')
    // With the override, a Cloudflare edge is no longer trusted.
    expect(
      clientIpFromHeaders(headersMap({ 'x-forwarded-for': '198.51.100.7, 172.67.1.1' })),
    ).toBe('172.67.1.1')
  })
})
