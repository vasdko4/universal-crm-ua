/**
 * Refresh lib/net/cloudflare-ips.ts from Cloudflare's published lists.
 * Run with: pnpm refresh:cloudflare-ips
 *
 * Fetches https://www.cloudflare.com/ips-v4 and /ips-v6, validates every
 * line as a CIDR, and rewrites the generated module. Exits non-zero (and
 * writes nothing) when either fetch fails or a line is malformed, so a
 * bad publish never silently empties the trusted-proxy list.
 */
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const V4_URL = 'https://www.cloudflare.com/ips-v4'
const V6_URL = 'https://www.cloudflare.com/ips-v6'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outPath = join(root, 'lib', 'net', 'cloudflare-ips.ts')

const V4_CIDR = /^(?:\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/
const V6_CIDR = /^[0-9a-fA-F:]+\/\d{1,3}$/

function validOctets(cidr) {
  return cidr
    .slice(0, cidr.indexOf('/'))
    .split('.')
    .every((o) => Number(o) <= 255)
}

async function fetchRanges(url, pattern) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`)
  const lines = (await res.text())
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) throw new Error(`${url} returned no ranges`)
  for (const line of lines) {
    if (!pattern.test(line) || (pattern === V4_CIDR && !validOctets(line))) {
      throw new Error(`${url} returned a malformed range: ${line}`)
    }
  }
  return lines
}

const v4 = await fetchRanges(V4_URL, V4_CIDR)
const v6 = await fetchRanges(V6_URL, V6_CIDR)

const today = new Date().toISOString().slice(0, 10)
const quote = (ranges) => ranges.map((r) => `  '${r}',`).join('\n')

const out = `/**
 * Cloudflare edge IP ranges (3.4.107 fix 1 — IP spoofing).
 *
 * Source: https://www.cloudflare.com/ips-v4 and
 * https://www.cloudflare.com/ips-v6 — fetched ${today} (${v4.length} v4 + ${v6.length} v6).
 * Regenerate with: pnpm refresh:cloudflare-ips
 * (scripts/refresh-cloudflare-ips.mjs).
 *
 * These are the ONLY addresses whose presence as the last X-Forwarded-For
 * hop vouches for the hops to their left. cf-connecting-ip is never trusted:
 * with the origin reachable directly, anyone can send it.
 */
import { isIpInCidrs } from '@/lib/net/ip'

export const CLOUDFLARE_IPV4_RANGES: string[] = [
${quote(v4)}
]

export const CLOUDFLARE_IPV6_RANGES: string[] = [
${quote(v6)}
]

export const CLOUDFLARE_IP_RANGES: string[] = [
  ...CLOUDFLARE_IPV4_RANGES,
  ...CLOUDFLARE_IPV6_RANGES,
]

/** True when \`ip\` belongs to a Cloudflare edge range. */
export function isCloudflareIp(ip: string): boolean {
  return isIpInCidrs(ip, CLOUDFLARE_IP_RANGES)
}
`

writeFileSync(outPath, out)
console.log(`wrote lib/net/cloudflare-ips.ts (${v4.length} v4 + ${v6.length} v6 ranges)`)
