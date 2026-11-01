import { describe, it, expect } from 'vitest'
import { clientIpFromHeaders } from '@/lib/api/rate-limit'

function headersMap(entries: Record<string, string>) {
  const lower = new Map(
    Object.entries(entries).map(([k, v]) => [k.toLowerCase(), v]),
  )
  return { get: (name: string) => lower.get(name.toLowerCase()) ?? null }
}

describe('clientIpFromHeaders behind Cloudflare', () => {
  it('trusts cf-connecting-ip only when cf-ray proves the request came via Cloudflare', () => {
    const h = headersMap({
      'cf-ray': '8a1b2c3d4e5f6a7b-KBP',
      'cf-connecting-ip': '93.184.216.34',
      'x-forwarded-for': '93.184.216.34, 172.67.1.1',
    })
    expect(clientIpFromHeaders(h)).toBe('93.184.216.34')
  })

  it('ignores a spoofed cf-connecting-ip sent without cf-ray', () => {
    const h = headersMap({
      'cf-connecting-ip': '1.2.3.4',
      'x-forwarded-for': '5.6.7.8, 172.67.1.1',
    })
    expect(clientIpFromHeaders(h)).toBe('172.67.1.1')
  })

  it('ignores a malformed cf-connecting-ip even with cf-ray', () => {
    const h = headersMap({
      'cf-ray': '8a1b2c3d4e5f6a7b-KBP',
      'cf-connecting-ip': 'not-an-ip',
      'x-real-ip': '9.9.9.9',
    })
    expect(clientIpFromHeaders(h)).toBe('9.9.9.9')
  })

  it('keeps the old precedence: vercel, then x-real-ip, then last xff hop', () => {
    expect(
      clientIpFromHeaders(
        headersMap({
          'x-vercel-forwarded-for': '10.0.0.1',
          'x-real-ip': '10.0.0.2',
          'x-forwarded-for': '10.0.0.3, 10.0.0.4',
        }),
      ),
    ).toBe('10.0.0.1')
    expect(clientIpFromHeaders(headersMap({ 'x-real-ip': '10.0.0.2' }))).toBe('10.0.0.2')
    expect(
      clientIpFromHeaders(headersMap({ 'x-forwarded-for': '10.0.0.3, 10.0.0.4' })),
    ).toBe('10.0.0.4')
    expect(clientIpFromHeaders(headersMap({}))).toBe('unknown')
  })
})
