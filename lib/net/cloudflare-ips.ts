/**
 * Cloudflare edge IP ranges (3.4.107 fix 1 — IP spoofing).
 *
 * Source: https://www.cloudflare.com/ips-v4 and
 * https://www.cloudflare.com/ips-v6 — fetched 2026-11-27 (15 v4 + 7 v6).
 * Regenerate with: pnpm refresh:cloudflare-ips
 * (scripts/refresh-cloudflare-ips.mjs).
 *
 * These are the ONLY addresses whose presence as the last X-Forwarded-For
 * hop vouches for the hops to their left. cf-connecting-ip is never trusted:
 * with the origin reachable directly, anyone can send it.
 */
import { isIpInCidrs } from '@/lib/net/ip'

export const CLOUDFLARE_IPV4_RANGES: string[] = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
]

export const CLOUDFLARE_IPV6_RANGES: string[] = [
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
]

export const CLOUDFLARE_IP_RANGES: string[] = [
  ...CLOUDFLARE_IPV4_RANGES,
  ...CLOUDFLARE_IPV6_RANGES,
]

/** True when `ip` belongs to a Cloudflare edge range. */
export function isCloudflareIp(ip: string): boolean {
  return isIpInCidrs(ip, CLOUDFLARE_IP_RANGES)
}
