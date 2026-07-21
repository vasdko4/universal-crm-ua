import 'server-only'

import { getStoreSettingsInternal } from '@/lib/store-settings'

/**
 * Resolves the canonical public origin of the store from environment only.
 *
 * Priority:
 *  1. NEXT_PUBLIC_SITE_URL   — set this to your real domain in production.
 *  2. BETTER_AUTH_URL        — already configured for auth callbacks.
 *  3. VERCEL_URL             — automatic per-deployment URL on Vercel.
 *  4. http://localhost:3000  — local development fallback.
 */
export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.BETTER_AUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'http://localhost:3000'
  return raw.replace(/\/+$/, '')
}

/**
 * Canonical origin with the domain configured in store settings (setup wizard
 * or Настройки → SEO) taking priority over environment variables. This is what
 * sitemap, robots, canonical links and structured data should use, so the
 * script works on any hosting without editing env vars.
 */
export async function getCanonicalSiteUrl(): Promise<string> {
  try {
    const s = await getStoreSettingsInternal()
    const fromDb = s.seo?.siteUrl?.trim()
    if (fromDb) return normalizeOrigin(fromDb)
  } catch {
    // DB unavailable (e.g. during setup) — fall back to env resolution.
  }
  return getSiteUrl()
}

/** Normalizes user input like "mystore.com/" into "https://mystore.com". */
export function normalizeOrigin(input: string): string {
  let v = input.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`
  try {
    return new URL(v).origin
  } catch {
    return getSiteUrl()
  }
}

/**
 * Joins a base origin with a path. If `path` is already an absolute URL
 * (e.g. a Vercel Blob / external image URL stored in the DB), it is returned
 * unchanged instead of being incorrectly appended to the origin.
 */
export function toAbsolute(base: string, path = '/'): string {
  if (!path) return base
  if (/^https?:\/\//i.test(path)) return path
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`
}

/** Build an absolute URL from a path against the site origin (env-based). */
export function absoluteUrl(path = '/'): string {
  return toAbsolute(getSiteUrl(), path)
}

/**
 * Async variant of absoluteUrl that honors the domain configured in store
 * settings (Настройки → SEO) over env vars — use this (not `absoluteUrl`) for
 * canonical links, JSON-LD and breadcrumbs on storefront pages, matching what
 * sitemap.xml / robots.txt / metadataBase already do.
 */
export async function canonicalUrl(path = '/'): Promise<string> {
  const base = await getCanonicalSiteUrl()
  return toAbsolute(base, path)
}

/**
 * Extracts a brand/manufacturer name from a product's characteristic list.
 * Recognizes both Ukrainian and Russian keys used across the catalog.
 */
export function extractBrand(characteristics: { name: string; value: string }[]): string | null {
  const keys = ['бренд', 'виробник', 'производитель', 'марка', 'brand', 'manufacturer']
  for (const c of characteristics) {
    if (keys.includes(c.name.trim().toLowerCase()) && c.value.trim()) return c.value.trim()
  }
  return null
}

/**
 * A merchant return policy that reflects Ukrainian consumer law (14-day
 * return window). Included in Product structured data so listings can show
 * return info in rich results.
 */
export function merchantReturnPolicy() {
  return {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: 'UA',
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: 14,
    returnMethod: 'https://schema.org/ReturnByMail',
    returnFees: 'https://schema.org/FreeReturn',
  }
}

/** Basic shipping details (Nova Poshta / Ukrposhta, delivery across Ukraine). */
export function shippingDetails(currency = 'UAH') {
  return {
    '@type': 'OfferShippingDetails',
    shippingRate: { '@type': 'MonetaryAmount', value: 0, currency },
    shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'UA' },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
      transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 3, unitCode: 'DAY' },
    },
  }
}
