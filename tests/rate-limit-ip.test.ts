import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { clientIpFromHeaders, unknownIpCeiling } from '@/lib/api/rate-limit'

function headers(init: Record<string, string>) {
  return new Headers(init)
}

// The suite runs off Vercel by default; the Vercel branch is enabled
// explicitly per test via stubEnv.
beforeEach(() => {
  vi.stubEnv('VERCEL', '')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('clientIpFromHeaders', () => {
  it('trusts x-vercel-forwarded-for only when running on Vercel (VERCEL=1)', () => {
    vi.stubEnv('VERCEL', '1')
    expect(
      clientIpFromHeaders(
        headers({
          'x-vercel-forwarded-for': '203.0.113.9',
          'x-real-ip': '198.51.100.2',
          'x-forwarded-for': '1.1.1.1, 10.0.0.1',
        }),
      ),
    ).toBe('203.0.113.9')
  })

  it('ignores a spoofed x-vercel-forwarded-for off Vercel', () => {
    expect(
      clientIpFromHeaders(
        headers({
          'x-vercel-forwarded-for': '203.0.113.9',
          'x-forwarded-for': '1.1.1.1, 10.0.0.1',
        }),
      ),
    ).toBe('10.0.0.1')
  })

  it('ignores a malformed x-vercel-forwarded-for even on Vercel', () => {
    vi.stubEnv('VERCEL', '1')
    expect(
      clientIpFromHeaders(
        headers({
          'x-vercel-forwarded-for': 'not-an-ip',
          'x-forwarded-for': '1.1.1.1, 10.0.0.1',
        }),
      ),
    ).toBe('10.0.0.1')
  })

  it('never trusts x-real-ip: it is purely client-controlled', () => {
    expect(clientIpFromHeaders(headers({ 'x-real-ip': '198.51.100.2' }))).toBe('unknown')
    expect(
      clientIpFromHeaders(
        headers({
          'x-real-ip': '198.51.100.2',
          'x-forwarded-for': '1.1.1.1, 10.0.0.1',
        }),
      ),
    ).toBe('10.0.0.1')
  })

  it('uses the last XFF hop so the client cannot mint a fresh bucket', () => {
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': '8.8.8.8, 10.0.0.4' }))).toBe(
      '10.0.0.4',
    )
  })

  it('ignores a malformed last XFF hop instead of keying on garbage', () => {
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': '8.8.8.8, not-an-ip' }))).toBe(
      'unknown',
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
