import { NextRequest, NextResponse } from 'next/server'
import { getFeedProducts, type FeedProduct } from '@/lib/shop/queries'
import { getCanonicalSiteUrl, toAbsolute } from '@/lib/seo'
import { getStoreSettingsInternal } from '@/lib/store-settings'
import { localizedPath, type Locale } from '@/lib/i18n/config'

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

function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// Feed descriptions must be plain text — product descriptions here come from
// the admin's rich-text editor, so strip tags and collapse whitespace/
// entities. Doesn't need to be perfect, just readable and valid XML once
// escaped again below.
function htmlToPlainText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 5000) // Google's hard cap on <description>.
}

function priceTag(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`
}

function buildItem(p: FeedProduct, siteUrl: string, locale: Locale): string {
  const abs = (path: string) => toAbsolute(siteUrl, path)
  const link = abs(localizedPath(`/product/${p.id}`, locale))
  const image = p.image ? abs(p.image) : null
  if (!image) return '' // Google rejects items with no image; skip rather than submit a broken one.

  const additionalImages = p.images
    .filter((img) => img && img !== p.image)
    .slice(0, 10) // Google allows at most 10 additional_image_link entries.
    .map((img) => `      <g:additional_image_link>${escapeXml(abs(img))}</g:additional_image_link>`)
    .join('\n')

  const availability = p.inStock ? 'in stock' : 'out of stock'
  const description = htmlToPlainText(p.description ?? p.name)

  // We don't store GTIN/MPN, and brand is only known when the admin filled a
  // "Бренд/Виробник" characteristic — Google requires either a real
  // identifier (gtin/mpn+brand) or an explicit identifier_exists=no.
  const brandTag = p.brand ? `      <g:brand>${escapeXml(p.brand)}</g:brand>\n` : ''
  const identifierExists = p.brand ? '' : '      <g:identifier_exists>no</g:identifier_exists>\n'

  const saleTag =
    p.oldPrice && p.oldPrice > p.price
      ? `      <g:price>${priceTag(p.oldPrice, p.currency)}</g:price>\n      <g:sale_price>${priceTag(p.price, p.currency)}</g:sale_price>\n`
      : `      <g:price>${priceTag(p.price, p.currency)}</g:price>\n`

  return `    <item>
      <g:id>${p.id}</g:id>
      <title>${escapeXml(p.name)}</title>
      <description>${escapeXml(description)}</description>
      <link>${escapeXml(link)}</link>
      <g:image_link>${escapeXml(image)}</g:image_link>
${additionalImages ? additionalImages + '\n' : ''}      <g:availability>${availability}</g:availability>
${saleTag}${brandTag}${identifierExists}      <g:condition>new</g:condition>
${p.sku ? `      <g:mpn>${escapeXml(p.sku)}</g:mpn>\n` : ''}    </item>`
}

export async function GET(req: NextRequest) {
  const localeParam = req.nextUrl.searchParams.get('locale')
  const locale: Locale = localeParam === 'ru' ? 'ru' : 'uk'

  const settings = await getStoreSettingsInternal().catch(() => null)
  // Respect the same global "hide from search engines" switch as
  // robots.ts/sitemap.ts — a pre-launch/staging store shouldn't leak its
  // catalog to Merchant Center either.
  if (settings?.seo?.indexingEnabled === false) {
    return new NextResponse('Store indexing is disabled', { status: 404 })
  }

  const siteUrl = await getCanonicalSiteUrl()
  const products = await getFeedProducts(locale)

  const items = products
    .filter((p) => p.price > 0) // Google rejects $0 items.
    .map((p) => buildItem(p, siteUrl, locale))
    .filter(Boolean)
    .join('\n')

  const storeName = settings?.storeName || 'Online Store'
  const storeDescription = settings?.storeDescription || storeName

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(storeName)}</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>${escapeXml(storeDescription)}</description>
${items}
  </channel>
</rss>
`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}
