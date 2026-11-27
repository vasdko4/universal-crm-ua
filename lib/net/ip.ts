/**
 * IP parsing and CIDR matching (3.4.107 fix 1 — IP spoofing).
 *
 * Deliberately BigInt-free: tsconfig targets ES2017, where BigInt literals
 * fail with TS2737. IPv6 addresses are 8 x 16-bit groups (number[]), and
 * masking is done per group in maskV6Groups(). ::ffff:a.b.c.d mapped
 * addresses are handled by group comparison (see isIPv4MappedIPv6()).
 */

export type ParsedIp = { kind: 'v4'; value: number[] } | { kind: 'v6'; value: number[] }

/** Parse a dotted-quad IPv4 address into 4 octets, or null. */
export function parseIPv4(value: string): number[] | null {
  const parts = value.split('.')
  if (parts.length !== 4) return null
  const out: number[] = []
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const n = Number(part)
    if (n > 255) return null
    out.push(n)
  }
  return out
}

function parseV6Group(group: string): number | null {
  if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null
  return parseInt(group, 16)
}

/**
 * Parse an IPv6 address into 8 x 16-bit groups, or null. Handles `::`
 * compression (at most once) and an embedded trailing IPv4 address
 * (`::ffff:192.0.2.1`). A trailing `%zone` id is stripped.
 */
export function parseIPv6(value: string): number[] | null {
  let s = value.trim()
  const pct = s.indexOf('%')
  if (pct !== -1) s = s.slice(0, pct)
  if (!s || !/^[0-9a-fA-F:.]+$/.test(s)) return null
  // A single leading/trailing ':' is only legal as part of '::'.
  if (s.startsWith(':') && !s.startsWith('::')) return null
  if (s.endsWith(':') && !s.endsWith('::')) return null

  // Embedded IPv4 in the last 32 bits: rewrite it as two hex groups.
  const lastColon = s.lastIndexOf(':')
  const tail = lastColon === -1 ? s : s.slice(lastColon + 1)
  if (tail.includes('.')) {
    const v4 = parseIPv4(tail)
    if (!v4) return null
    const hi = ((v4[0] << 8) | v4[1]).toString(16)
    const lo = ((v4[2] << 8) | v4[3]).toString(16)
    s = `${s.slice(0, lastColon + 1)}${hi}:${lo}`
  }

  const dbl = s.indexOf('::')
  if (dbl !== -1) {
    if (s.indexOf('::', dbl + 2) !== -1) return null
    const head = s.slice(0, dbl) === '' ? [] : s.slice(0, dbl).split(':')
    const tailParts = s.slice(dbl + 2) === '' ? [] : s.slice(dbl + 2).split(':')
    if (head.length + tailParts.length > 7) return null
    const groups: number[] = []
    for (const g of head) {
      const n = parseV6Group(g)
      if (n === null) return null
      groups.push(n)
    }
    const missing = 8 - head.length - tailParts.length
    for (let i = 0; i < missing; i++) groups.push(0)
    for (const g of tailParts) {
      const n = parseV6Group(g)
      if (n === null) return null
      groups.push(n)
    }
    return groups
  }

  const parts = s.split(':')
  if (parts.length !== 8) return null
  const groups: number[] = []
  for (const g of parts) {
    const n = parseV6Group(g)
    if (n === null) return null
    groups.push(n)
  }
  return groups
}

/** Parse an IPv4 or IPv6 address (zone id stripped), or null. */
export function parseIp(value: string): ParsedIp | null {
  const s = value.trim()
  if (!s) return null
  if (s.includes(':')) {
    const v6 = parseIPv6(s)
    return v6 ? { kind: 'v6', value: v6 } : null
  }
  const v4 = parseIPv4(s)
  return v4 ? { kind: 'v4', value: v4 } : null
}

/** Apply a /prefix mask to 8 IPv6 groups; returns a new array. */
export function maskV6Groups(groups: number[], prefix: number): number[] {
  return groups.map((g, i) => {
    const bits = Math.max(0, Math.min(16, prefix - i * 16))
    if (bits === 16) return g
    if (bits === 0) return 0
    return g & ((0xffff << (16 - bits)) & 0xffff)
  })
}

/** Apply a /prefix mask to 4 IPv4 octets; returns a new array. */
export function maskV4Octets(octets: number[], prefix: number): number[] {
  return octets.map((o, i) => {
    const bits = Math.max(0, Math.min(8, prefix - i * 8))
    if (bits === 8) return o
    if (bits === 0) return 0
    return o & ((0xff << (8 - bits)) & 0xff)
  })
}

/** True when the 8 groups are an IPv4-mapped IPv6 address (::ffff:a.b.c.d). */
export function isIPv4MappedIPv6(groups: number[]): boolean {
  return (
    groups.length === 8 &&
    groups[0] === 0 &&
    groups[1] === 0 &&
    groups[2] === 0 &&
    groups[3] === 0 &&
    groups[4] === 0 &&
    groups[5] === 0xffff
  )
}

/** Embed 4 IPv4 octets as an IPv4-mapped IPv6 address (::ffff:a.b.c.d). */
export function ipv4ToV6Groups(octets: number[]): number[] {
  return [0, 0, 0, 0, 0, 0xffff, (octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]]
}

/** Extract the IPv4 octets from an IPv4-mapped IPv6 address, or null. */
export function v6GroupsToIPv4(groups: number[]): number[] | null {
  if (!isIPv4MappedIPv6(groups)) return null
  return [(groups[6] >> 8) & 0xff, groups[6] & 0xff, (groups[7] >> 8) & 0xff, groups[7] & 0xff]
}

/**
 * True when `ip` lies in `cidr` ("192.0.2.0/24", "2001:db8::/32").
 * IPv4 addresses also match IPv4-mapped IPv6 CIDRs and vice versa (a v4
 * /prefix is compared as a v6 /(96+prefix) against the mapped form).
 */
export function isIpInCidr(ip: string, cidr: string): boolean {
  const slash = cidr.lastIndexOf('/')
  if (slash === -1) return false
  const prefix = Number(cidr.slice(slash + 1))
  if (!Number.isInteger(prefix)) return false
  const parsedIp = parseIp(ip)
  const parsedBase = parseIp(cidr.slice(0, slash))
  if (!parsedIp || !parsedBase) return false

  if (parsedIp.kind === 'v4' && parsedBase.kind === 'v4') {
    if (prefix < 0 || prefix > 32) return false
    const a = maskV4Octets(parsedIp.value, prefix)
    const b = maskV4Octets(parsedBase.value, prefix)
    return a.every((o, i) => o === b[i])
  }

  // Compare in IPv6 space; a v4 base prefix counts from the mapped offset.
  const ipV6 = parsedIp.kind === 'v6' ? parsedIp.value : ipv4ToV6Groups(parsedIp.value)
  const baseV6 = parsedBase.kind === 'v6' ? parsedBase.value : ipv4ToV6Groups(parsedBase.value)
  const effectivePrefix = parsedBase.kind === 'v4' ? prefix + 96 : prefix
  if (effectivePrefix < 0 || effectivePrefix > 128) return false
  const a = maskV6Groups(ipV6, effectivePrefix)
  const b = maskV6Groups(baseV6, effectivePrefix)
  return a.every((g, i) => g === b[i])
}

/** True when `ip` lies in any of the given CIDR ranges. */
export function isIpInCidrs(ip: string, cidrs: readonly string[]): boolean {
  return cidrs.some((c) => isIpInCidr(ip, c))
}
