import type { MetadataRoute } from 'next'
import { getCanonicalSiteUrl } from '@/lib/seo'
import { getStoreSettingsInternal } from '@/lib/store-settings'

// Uses the domain configured in store settings; honors the global indexing
// switch (pre-launch stores can stay fully hidden from crawlers).
export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = await getCanonicalSiteUrl()
  const s = await getStoreSettingsInternal().catch(() => null)
  const indexable = s?.seo?.indexingEnabled !== false

  // Private/transactional areas, disallowed for both the default (unprefixed,
  // 'uk') storefront and its /ru counterpart — a bare "/cart" rule only
  // matches the uk URL, not "/ru/cart", so each needs its own entry.
  const privateAreas = ['/admin', '/account', '/cart', '/checkout', '/api/', '/setup', '/sign-in']
  const disallow = privateAreas.flatMap((p) => [p, `/ru${p}`])

  return {
    rules: [
      indexable
        ? {
            userAgent: '*',
            allow: '/',
            disallow,
          }
        : { userAgent: '*', disallow: '/' },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
