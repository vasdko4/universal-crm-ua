import { describe, it, expect } from 'vitest'
import {
  parseIp,
  parseIPv6,
  maskV6Groups,
  isIpInCidr,
  isIPv4MappedIPv6,
  ipv4ToV6Groups,
} from '@/lib/net/ip'
import {
  CLOUDFLARE_IPV4_RANGES,
  CLOUDFLARE_IPV6_RANGES,
  CLOUDFLARE_IP_RANGES,
  isCloudflareIp,
} from '@/lib/net/cloudflare-ips'

describe('Cloudflare IP ranges', () => {
  it('publishes 15 IPv4 ranges', () => {
    expect(CLOUDFLARE_IPV4_RANGES).toHaveLength(15)
    for (const r of CLOUDFLARE_IPV4_RANGES) {
      expect(r).toMatch(/^(?:\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/)
    }
  })

  it('publishes 7 IPv6 ranges', () => {
    expect(CLOUDFLARE_IPV6_RANGES).toHaveLength(7)
    for (const r of CLOUDFLARE_IPV6_RANGES) {
      expect(r).toMatch(/^[0-9a-fA-F:]+\/\d{1,3}$/)
    }
  })

  it('combines into 22 ranges', () => {
    expect(CLOUDFLARE_IP_RANGES).toHaveLength(22)
    expect(CLOUDFLARE_IP_RANGES).toEqual([
      ...CLOUDFLARE_IPV4_RANGES,
      ...CLOUDFLARE_IPV6_RANGES,
    ])
  })

  it('matches a Cloudflare edge IP and rejects a public non-CF IP', () => {
    expect(isCloudflareIp('172.67.1.1')).toBe(true)
    expect(isCloudflareIp('104.16.0.1')).toBe(true)
    expect(isCloudflareIp('2606:4700::1')).toBe(true)
    expect(isCloudflareIp('8.8.8.8')).toBe(false)
    expect(isCloudflareIp('203.0.113.5')).toBe(false)
    expect(isCloudflareIp('not-an-ip')).toBe(false)
  })
})

describe('parseIp (no BigInt: IPv6 is 8 x 16-bit groups)', () => {
  it("parses '::1' as eight groups", () => {
    expect(parseIp('::1')).toEqual({ kind: 'v6', value: [0, 0, 0, 0, 0, 0, 0, 1] })
  })

  it('parses a dotted-quad IPv4 address', () => {
    expect(parseIp('192.0.2.1')).toEqual({ kind: 'v4', value: [192, 0, 2, 1] })
  })

  it('rejects garbage, out-of-range octets and empty input', () => {
    expect(parseIp('not-an-ip')).toBeNull()
    expect(parseIp('1.2.3.999')).toBeNull()
    expect(parseIp('')).toBeNull()
    expect(parseIp('1::2::3')).toBeNull()
  })

  it('parses an IPv4-mapped IPv6 address by group comparison', () => {
    const groups = parseIPv6('::ffff:192.0.2.1')
    expect(groups).toEqual([0, 0, 0, 0, 0, 0xffff, 0xc000, 0x0201])
    expect(groups && isIPv4MappedIPv6(groups)).toBe(true)
    expect(groups && ipv4ToV6Groups([192, 0, 2, 1])).toEqual(groups)
  })

  it('maskV6Groups masks per 16-bit group', () => {
    expect(maskV6Groups([0xffff, 0xffff, 0xffff, 0, 0, 0, 0, 0], 32)).toEqual([
      0xffff, 0xffff, 0, 0, 0, 0, 0, 0,
    ])
    expect(maskV6Groups([0xffff, 0, 0, 0, 0, 0, 0, 0], 8)).toEqual([
      0xff00, 0, 0, 0, 0, 0, 0, 0,
    ])
    expect(maskV6Groups([0x2606, 0x4700, 0, 0, 0, 0, 0, 1], 32)).toEqual([
      0x2606, 0x4700, 0, 0, 0, 0, 0, 0,
    ])
  })
})

describe('isIpInCidr', () => {
  it('matches IPv4 addresses inside and outside a range, at the boundary', () => {
    expect(isIpInCidr('173.245.48.1', '173.245.48.0/20')).toBe(true)
    expect(isIpInCidr('173.245.63.255', '173.245.48.0/20')).toBe(true)
    expect(isIpInCidr('173.245.64.0', '173.245.48.0/20')).toBe(false)
    expect(isIpInCidr('173.245.47.255', '173.245.48.0/20')).toBe(false)
  })

  it('matches IPv6 addresses inside and outside a range', () => {
    expect(isIpInCidr('2606:4700::1', '2606:4700::/32')).toBe(true)
    expect(isIpInCidr('2606:4700:ffff::1', '2606:4700::/32')).toBe(true)
    expect(isIpInCidr('2606:4701::1', '2606:4700::/32')).toBe(false)
    expect(isIpInCidr('2a06:98c0::1', '2a06:98c0::/29')).toBe(true)
    expect(isIpInCidr('2a06:98c8::1', '2a06:98c0::/29')).toBe(false)
  })

  it('matches IPv4-mapped IPv6 addresses against v4 and mapped v6 CIDRs', () => {
    expect(isIpInCidr('::ffff:173.245.48.1', '173.245.48.0/20')).toBe(true)
    expect(isIpInCidr('173.245.48.1', '::ffff:173.245.48.0/120')).toBe(true)
    expect(isIpInCidr('::ffff:8.8.8.8', '173.245.48.0/20')).toBe(false)
  })
})
