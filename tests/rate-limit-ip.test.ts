import { describe, it, expect } from 'vitest'
import { clientIpFromHeaders, unknownIpCeiling } from '@/lib/api/rate-limit'

function headers(init: Record<string, string>) {
  return new Headers(init)
}

describe('clientIpFromHeaders', () => {
  it('prefers Vercel then X-Real-IP', () => {
    expect(
      clientIpFromHeaders(
        headers({
          'x-vercel-forwarded-for': '203.0.113.9',
          'x-real-ip': '198.51.100.2',
          'x-forwarded-for': '1.1.1.1, 10.0.0.1',
        }),
      ),
    ).toBe('203.0.113.9')
    expect(clientIpFromHeaders(headers({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2')
  })

  it('uses the last XFF hop so the client cannot mint a fresh bucket', () => {
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': '8.8.8.8, 10.0.0.4' }))).toBe(
      '10.0.0.4',
    )
  })

  it('falls back to unknown when nothing is present', () => {
    expect(clientIpFromHeaders(headers({}))).toBe('unknown')
  })
})

describe('unknownIpCeiling', () => {
  it('raises the shared unknown bucket well above the per-IP max', () => {
    expect(unknownIpCeiling(5)).toBeGreaterThanOrEqual(200)
    expect(unknownIpCeiling(30)).toBe(600)
  })
})
