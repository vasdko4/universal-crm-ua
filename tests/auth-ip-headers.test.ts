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

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('trustedAuthProxies', () => {
  it('defaults to localhost plus the Docker bridge range', () => {
    vi.stubEnv('TRUSTED_PROXIES', '')
    expect(trustedAuthProxies()).toEqual(['127.0.0.1/32', '::1/128', '172.16.0.0/12'])
  })

  it('falls back to the default for a whitespace-only override', () => {
    vi.stubEnv('TRUSTED_PROXIES', '   ')
    expect(trustedAuthProxies()).toEqual(['127.0.0.1/32', '::1/128', '172.16.0.0/12'])
  })

  it('honours the TRUSTED_PROXIES env override, split and trimmed', () => {
    vi.stubEnv('TRUSTED_PROXIES', ' 10.0.0.0/8 , 203.0.113.1/32,, ')
    expect(trustedAuthProxies()).toEqual(['10.0.0.0/8', '203.0.113.1/32'])
  })
})

describe('AUTH_IP_ADDRESS_HEADERS', () => {
  it('trusts cf-connecting-ip first, then the Vercel/dev fallbacks', () => {
    expect(AUTH_IP_ADDRESS_HEADERS).toEqual([
      'cf-connecting-ip',
      'x-vercel-forwarded-for',
      'x-real-ip',
      'x-forwarded-for',
    ])
  })
})
