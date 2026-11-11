import { NextRequest, NextResponse } from 'next/server'
import { getFeedProducts } from '@/lib/shop/queries'
import { getCanonicalSiteUrl } from '@/lib/seo'
import { getStoreSettingsOrNull } from '@/lib/store-settings'
import { type Locale } from '@/lib/i18n/config'
import {
  buildItemXml,
  buildMerchantRss,
  expandFeedOffers,
} from '@/lib/shop/google-merchant-feed'

export const dynamic = 'force-dynamic'
// Merchant Center re-fetches on its own schedule (usually every few hours to
// once a day); no need to regenerate this on every crawl hit.
export const revalidate = 3600

// Google Merchant Center product feed (RSS 2.0 + the `g:` product namespace).
// Register this URL directly as a "scheduled fetch" feed in Merchant Center —
// https://support.google.com/merchants/answer/7439558 — no API/OAuth wiring
// needed on our side.
//
// Usage: /feed/google-merchant.xml            → 'uk' catalog (site default)
//        /feed/google-merchant.xml?locale=ru  → 'ru' catalog, if you want a
//                                                separate feed for Russian-
//                                                language Shopping ads.

export async function GET(req: NextRequest) {
  const localeParam = req.nextUrl.searchParams.get('locale')
  const locale: Locale = localeParam === 'ru' ? 'ru' : 'uk'

  const settings = await getStoreSettingsOrNull()
  // Respect the same global "hide from search engines" switch as
  // robots.ts/sitemap.ts — a pre-launch/staging store shouldn't leak its
  // catalog to Merchant Center either. Fail closed: when settings can't be
  // read at all (DB error), the feed is hidden instead of served.
  if (settings == null || settings.seo?.indexingEnabled === false) {
    return new NextResponse('Store indexing is disabled', { status: 404 })
  }

  const siteUrl = await getCanonicalSiteUrl()
  const products = await getFeedProducts(locale)
  const merchant = settings?.merchantFeed ?? {
    googleProductCategory: '',
    shippingPrice: '',
    shippingCountry: 'UA',
  }

  const items = products
    .flatMap((p) => expandFeedOffers(p))
    .map((offer) => buildItemXml(offer, siteUrl, locale, merchant))
    .filter(Boolean)
    .join('\n')

  const storeName = settings?.storeName || 'Online Store'
  const storeDescription = settings?.storeDescription || storeName

  const xml = buildMerchantRss({
    storeName,
    storeDescription,
    siteUrl,
    itemsXml: items,
  })

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}
