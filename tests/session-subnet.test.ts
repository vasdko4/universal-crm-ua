import { describe, it, expect, vi } from 'vitest'

// lib/session pulls in Next boundary modules at import time (next/headers,
// next/navigation, and next/cache via lib/auth → lib/store-settings, which
// calls unstable_cache at module scope) — stub them; the code under test
// never calls them.
vi.mock('next/cache', () => ({
  unstable_cache: (fn: unknown) => fn,
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))
vi.mock('next/headers', () => ({ cookies: vi.fn(), headers: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

import { sameSubnet24 } from '@/lib/session'

describe('sameSubnet24 — IPv4 keeps its /24 behavior', () => {
  it('identical addresses match', () => {
    expect(sameSubnet24('192.168.1.10', '192.168.1.10')).toBe(true)
  })

  it('same /24 matches', () => {
    expect(sameSubnet24('192.168.1.10', '192.168.1.200')).toBe(true)
  })

  it('different /24 does not match', () => {
    expect(sameSubnet24('192.168.1.10', '192.168.2.10')).toBe(false)
    expect(sameSubnet24('10.0.0.1', '192.168.1.1')).toBe(false)
  })

  it('IPv4 never matches IPv6', () => {
    expect(sameSubnet24('192.168.1.1', '2001:db8::1')).toBe(false)
  })
})

describe('sameSubnet24 — IPv6 tolerates a /64 rotation', () => {
  it('identical addresses match', () => {
    expect(sameSubnet24('2001:db8:85a3::8a2e:370:7334', '2001:db8:85a3::8a2e:370:7334')).toBe(true)
  })

  it('same /64 with a different interface ID matches (privacy-extension rotation)', () => {
    expect(sameSubnet24('2001:db8:85a3::8a2e:370:7334', '2001:db8:85a3::8a2e:370:9999')).toBe(true)
    expect(sameSubnet24('2001:db8:85a3::1', '2001:db8:85a3:0:0:8a2e:370:7334')).toBe(true)
  })

  it('different /64 does not match', () => {
    expect(sameSubnet24('2001:db8:85a3:1::1', '2001:db8:85a3:2::1')).toBe(false)
    expect(sameSubnet24('2001:db8::1', '2001:db9::1')).toBe(false)
  })

  it(':: expansion compares equal to the full form', () => {
    expect(sameSubnet24('2001:db8::1', '2001:db8:0:0:0:0:0:1')).toBe(true)
    expect(sameSubnet24('::1', '0:0:0:0:0:0:0:1')).toBe(true)
  })

  it('loopback addresses share a /64', () => {
    expect(sameSubnet24('::1', '::2')).toBe(true)
  })

  it('hex is case-insensitive', () => {
    expect(sameSubnet24('2001:DB8::1', '2001:db8::2')).toBe(true)
  })

  it('zone ids are stripped before comparing', () => {
    expect(sameSubnet24('fe80::1%eth0', 'fe80::2')).toBe(true)
  })
})

describe('sameSubnet24 — IPv4-mapped IPv6 compares as its IPv4 twin', () => {
  it('mapped address matches the same /24 in plain form', () => {
    expect(sameSubnet24('::ffff:192.0.2.1', '192.0.2.55')).toBe(true)
  })

  it('mapped address does not match a different /24', () => {
    expect(sameSubnet24('::ffff:192.0.2.1', '192.0.3.1')).toBe(false)
  })

  it('two mapped addresses compare as IPv4', () => {
    expect(sameSubnet24('::ffff:192.0.2.1', '::ffff:192.0.2.99')).toBe(true)
    expect(sameSubnet24('::ffff:192.0.2.1', '::ffff:10.0.0.1')).toBe(false)
  })
})

describe('sameSubnet24 — garbage never matches', () => {
  it('different non-IP strings do not match', () => {
    expect(sameSubnet24('not-an-ip', 'also-not')).toBe(false)
    expect(sameSubnet24('1.2.3.4.5', '1.2.3.4')).toBe(false)
    expect(sameSubnet24('2001:db8:::1', '2001:db8::1')).toBe(false)
  })

  it('identical strings still match (fast path)', () => {
    expect(sameSubnet24('not-an-ip', 'not-an-ip')).toBe(true)
  })
})
