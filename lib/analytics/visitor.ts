/**
 * Visitor detail for analytics: bot detection and geo resolution.
 *
 * - Bots are detected from the User-Agent string with a pattern list
 *   (search crawlers, social preview fetchers, SEO scanners).
 * - Geo comes from the `cf-ipcountry` header when the request passes
 *   through Cloudflare (fast path, no external call). Region/city fall
 *   back to a cached ip-api.com lookup so we never hammer the free API.
 * - IPs are never stored raw: only a sha256 hash is kept, and the hash
 *   is what keys the geo_cache table.
 */

import { createHash } from 'crypto'
import { pool } from '@/lib/db'

export type GeoInfo = { country: string | null; region: string | null; city: string | null }

const BOT_PATTERNS: Array<{ re: RegExp; name: string }> = [
  { re: /googlebot|google-inspectiontool|googleother|storebot-google/i, name: 'Googlebot' },
  { re: /bingbot|msnbot|adidxbot/i, name: 'Bingbot' },
  { re: /slurp/i, name: 'Yahoo Slurp' },
  { re: /duckduckbot/i, name: 'DuckDuckBot' },
  { re: /baiduspider/i, name: 'Baiduspider' },
  { re: /yandexbot|yandeximages|yandexvideo|yandexmedia/i, name: 'YandexBot' },
  { re: /sogou/i, name: 'Sogou' },
  { re: /exabot/i, name: 'Exabot' },
  { re: /facebookexternalhit|facebookcatalog/i, name: 'Facebook' },
  { re: /twitterbot/i, name: 'Twitterbot' },
  { re: /linkedinbot/i, name: 'LinkedInBot' },
  { re: /telegrambot/i, name: 'TelegramBot' },
  { re: /whatsapp/i, name: 'WhatsApp' },
  { re: /discordbot/i, name: 'Discordbot' },
  { re: /slackbot/i, name: 'Slackbot' },
  { re: /applebot/i, name: 'Applebot' },
  { re: /petalbot/i, name: 'PetalBot' },
  { re: /ahrefsbot/i, name: 'AhrefsBot' },
  { re: /semrushbot/i, name: 'SemrushBot' },
  { re: /mj12bot/i, name: 'MJ12bot' },
  { re: /dotbot/i, name: 'DotBot' },
  { re: /rogerbot/i, name: 'Rogerbot' },
  { re: /seznambot/i, name: 'SeznamBot' },
  { re: /coccocbot/i, name: 'CocolyBot' },
  { re: /ia_archiver/i, name: 'Alexa' },
  { re: /archive\.org_bot/i, name: 'Archive.org' },
  { re: /uptimerobot|pingdom|statuscake|betteruptime|hetrixtools/i, name: 'Uptime monitor' },
  { re: /headlesschrome|phantomjs|selenium/i, name: 'Headless browser' },
  // Generic crawler tokens — keep last, they are broad.
  { re: /bot|crawl|spider|scrape|scanner|monitor|checker|fetcher|preview/i, name: 'Other bot' },
]

export function detectBot(userAgent: string | null | undefined): { isBot: boolean; name: string | null } {
  if (!userAgent) return { isBot: false, name: null }
  for (const p of BOT_PATTERNS) {
    if (p.re.test(userAgent)) return { isBot: true, name: p.name }
  }
  return { isBot: false, name: null }
}

export function botName(userAgent: string | null | undefined): string | null {
  return detectBot(userAgent).name
}

export function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex')
}

const GEO_TIMEOUT_MS = 2500
// ip-api.com free tier: 45 req/min. Cache makes repeated hits free;
// this in-process budget is a backstop for bursts of brand-new IPs.
let geoBudgetReset = 0
let geoBudgetUsed = 0
const GEO_BUDGET_PER_MIN = 30

function geoBudgetAvailable(): boolean {
  const now = Date.now()
  if (now - geoBudgetReset > 60_000) {
    geoBudgetReset = now
    geoBudgetUsed = 0
  }
  return geoBudgetUsed < GEO_BUDGET_PER_MIN
}

async function lookupIpApi(ip: string): Promise<GeoInfo | null> {
  if (!geoBudgetAvailable()) return null
  // Skip private/loopback — ip-api would fail on them anyway.
  if (!ip || ip === 'unknown' || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.|::1)/.test(ip)) {
    return null
  }
  geoBudgetUsed += 1
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), GEO_TIMEOUT_MS)
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,countryCode,regionName,city`,
      { signal: ctrl.signal },
    )
    clearTimeout(t)
    if (!res.ok) return null
    const j = (await res.json()) as {
      status?: string
      countryCode?: string
      regionName?: string
      city?: string
    }
    if (j.status !== 'success') return null
    return {
      country: j.countryCode || null,
      region: j.regionName || null,
      city: j.city || null,
    }
  } catch {
    return null
  }
}

/**
 * Resolve geo for a visitor IP. Order:
 * 1. cf-ipcountry header (Cloudflare fast path — country only).
 * 2. geo_cache by IP hash (region/city from earlier lookups).
 * 3. ip-api.com lookup with budget guard, then cached.
 * Never throws — returns nulls on any failure.
 */
export async function resolveVisitorGeo(
  ip: string,
  cfCountry: string | null,
): Promise<GeoInfo> {
  const fast: GeoInfo = {
    country: cfCountry && /^[A-Z]{2}$/.test(cfCountry) ? cfCountry : null,
    region: null,
    city: null,
  }
  const ipHash = hashIp(ip)
  try {
    const cached = await pool.query(
      'SELECT country, region, city FROM geo_cache WHERE ip_hash = $1',
      [ipHash],
    )
    if (cached.rows.length > 0) {
      const row = cached.rows[0] as { country: string | null; region: string | null; city: string | null }
      return {
        country: row.country ?? fast.country,
        region: row.region,
        city: row.city,
      }
    }
  } catch {
    return fast
  }
  const looked = await lookupIpApi(ip)
  const geo: GeoInfo = {
    country: looked?.country ?? fast.country,
    region: looked?.region ?? null,
    city: looked?.city ?? null,
  }
  if (looked) {
    try {
      await pool.query(
        `INSERT INTO geo_cache (ip_hash, country, region, city)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (ip_hash) DO UPDATE
         SET country = EXCLUDED.country, region = EXCLUDED.region,
             city = EXCLUDED.city, resolved_at = NOW()`,
        [ipHash, geo.country, geo.region, geo.city],
      )
    } catch {
      // Cache write failure must not break tracking.
    }
  }
  return geo
}
