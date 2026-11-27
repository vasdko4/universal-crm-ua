import { describe, it, expect, vi, afterEach } from 'vitest'

// lib/auth pulls in Next boundary modules at import time (next/cache via
// lib/store-settings, which calls unstable_cache at module scope) — stub
// them; the code under test never calls them.
vi.mock('next/cache', () => ({
  unstable_cache: (fn: unknown) => fn,
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))
vi.mock('next/headers', () => ({ cookies: vi.fn(), headers: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

import { AUTH_IP_ADDRESS_HEADERS, trustedAuthProxies } from '@/lib/auth'
import { CLOUDFLARE_IP_RANGES } from '@/lib/net/cloudflare-ips'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('trustedAuthProxies (3.4.107 fix 1)', () => {
  it('defaults to localhost + Docker bridge + all Cloudflare ranges', () => {
    vi.stubEnv('TRUSTED_PROXIES', '')
    const proxies = trustedAuthProxies()
    expect(proxies).toHaveLength(3 + CLOUDFLARE_IP_RANGES.length)
    expect(proxies.slice(0, 3)).toEqual(['127.0.0.1/32', '::1/128', '172.16.0.0/12'])
    for (const range of CLOUDFLARE_IP_RANGES) {
      expect(proxies).toContain(range)
    }
  })

  it('falls back to the default for a whitespace-only override', () => {
    vi.stubEnv('TRUSTED_PROXIES', '   ')
    expect(trustedAuthProxies()).toHaveLength(3 + CLOUDFLARE_IP_RANGES.length)
    expect(trustedAuthProxies()[0]).toBe('127.0.0.1/32')
  })

  it('honours the TRUSTED_PROXIES env override, split and trimmed', () => {
    vi.stubEnv('TRUSTED_PROXIES', ' 10.0.0.0/8 , 203.0.113.1/32,, ')
    expect(trustedAuthProxies()).toEqual(['10.0.0.0/8', '203.0.113.1/32'])
  })
})

describe('AUTH_IP_ADDRESS_HEADERS (3.4.107 fix 1)', () => {
  it('lists only x-forwarded-for', () => {
    expect(AUTH_IP_ADDRESS_HEADERS).toEqual(['x-forwarded-for'])
  })

  it('never lists cf-connecting-ip, x-real-ip or x-vercel-forwarded-for', () => {
    expect(AUTH_IP_ADDRESS_HEADERS).not.toContain('cf-connecting-ip')
    expect(AUTH_IP_ADDRESS_HEADERS).not.toContain('cf-ray')
    expect(AUTH_IP_ADDRESS_HEADERS).not.toContain('x-real-ip')
    expect(AUTH_IP_ADDRESS_HEADERS).not.toContain('x-vercel-forwarded-for')
  })
})
