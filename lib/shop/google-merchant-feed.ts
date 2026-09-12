import { localizedPath, type Locale } from '@/lib/i18n/config'
import { decodeHtmlEntities } from '@/lib/html-entities'

function toAbsolute(base: string, path = '/'): string {
  if (!path) return base
  if (/^https?:\/\//i.test(path)) return path
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`
}

export type MerchantFeedSettings = {
  googleProductCategory: string
  shippingPrice: string
  shippingCountry: string
}

export type FeedVariant = {
  id: number
  options: Record<string, string>
  sku: string | null
  price: number
  oldPrice: number | null
  quantity: number
  inStock: boolean
  image: string | null
}

export type FeedProduct = {
  id: number
  name: string
  slug: string
  description: string | null
  price: number
  oldPrice: number | null
  currency: string
  inStock: boolean
  image: string | null
  images: string[]
  sku: string | null
  barcode: string | null
  weight: number | null
  variantsEnabled: boolean
  variants: FeedVariant[]
  isPreorder: boolean
  brand: string | null
}

export function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Feed descriptions must be plain text — admin copy is rich HTML.
 *
 * Decode entities first so encoded tags (`<script>`) become real tags
 * we can strip. After stripping, drop leftover `<`/`>` instead of unescaping
 * them again — that was the CodeQL "double unescape" hit: tag-strip then
 * `<` → `<` resurrected markup.
 */
export function htmlToPlainText(html: string): string {
  return decodeHtmlEntities(html)
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 5000)
}

export function priceTag(amount: number, currency: string): string {
  const cur = (currency || 'UAH').trim().toUpperCase() || 'UAH'
  return `${amount.toFixed(2)} ${cur}`
}

/**
 * Google requires `g:shipping > g:price` as `80.00 UAH`. Admins type `80`,
 * `80 грн` or `60 UAH` — accept those, drop anything we cannot parse.
 */
export function formatShippingPrice(raw: string, fallbackCurrency = 'UAH'): string | null {
  const t = raw.trim()
  if (!t) return null
  const m = t.match(/^(\d+(?:[.,]\d+)?)\s*(?:грн\.?|UAH|[A-Za-z]{3})?$/i)
  if (!m) return null
  const amount = Number(m[1].replace(',', '.'))
  if (!Number.isFinite(amount) || amount < 0) return null
  const curMatch = t.match(/\b([A-Za-z]{3})\b/)
  const cur = (curMatch?.[1] || fallbackCurrency).toUpperCase()
  return priceTag(amount, cur)
}

export function formatShippingWeightKg(weight: number | null | undefined): string | null {
  if (weight == null || !Number.isFinite(weight) || weight <= 0) return null
  return `${weight.toFixed(3)} kg`
}

/** GTIN/EAN/UPC: 8, 12, 13 or 14 digits after stripping punctuation. */
export function normalizeGtin(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if ([8, 12, 13, 14].includes(digits.length)) return digits
  return null
}

const COLOR_KEYS = ['колір', 'цвет', 'color', 'colour']
const SIZE_KEYS = ['розмір', 'размер', 'size']

export function variantColorSize(options: Record<string, string>): { color?: string; size?: string } {
  let color: string | undefined
  let size: string | undefined
  for (const [key, value] of Object.entries(options)) {
    if (!value?.trim()) continue
    const k = key.trim().toLowerCase()
    if (!color && COLOR_KEYS.includes(k)) color = value.trim()
    else if (!size && SIZE_KEYS.includes(k)) size = value.trim()
  }
  return { color, size }
}

export type MerchantOffer = {
  id: string
  itemGroupId?: string
  name: string
  slug: string
  description: string | null
  price: number
  oldPrice: number | null
  currency: string
  image: string | null
  images: string[]
  sku: string | null
  barcode: string | null
  brand: string | null
  weight: number | null
  isPreorder: boolean
  color?: string
  size?: string
}

function variantLive(v: FeedVariant, isPreorder: boolean): boolean {
  return (v.inStock && v.quantity > 0) || isPreorder
}

/** One Merchant row per purchasable offer (parent, or each in-stock variant). */
export function expandFeedOffers(p: FeedProduct): MerchantOffer[] {
  const base = {
    slug: p.slug,
    description: p.description,
    currency: p.currency,
    barcode: p.barcode,
    brand: p.brand,
    weight: p.weight,
    isPreorder: p.isPreorder,
  }

  if (p.variantsEnabled && p.variants.length > 0) {
    const live = p.variants.filter((v) => variantLive(v, p.isPreorder))
    if (live.length === 0) return []
    return live.map((v) => {
      const extra = Object.values(v.options).filter(Boolean).join(' / ')
      const { color, size } = variantColorSize(v.options)
      const price = v.price > 0 ? v.price : p.price
      return {
        ...base,
        id: `${p.id}-${v.id}`,
        itemGroupId: String(p.id),
        name: extra ? `${p.name} — ${extra}` : p.name,
        price,
        oldPrice: v.oldPrice && v.oldPrice > price ? v.oldPrice : p.oldPrice,
        image: v.image || p.image,
        images: p.images,
        sku: v.sku || p.sku,
        color,
        size,
      }
    })
  }

  if (!(p.inStock || p.isPreorder) || p.price <= 0) return []
  return [
    {
      ...base,
      id: String(p.id),
      name: p.name,
      price: p.price,
      oldPrice: p.oldPrice,
      image: p.image,
      images: p.images,
      sku: p.sku,
    },
  ]
}

export function buildItemXml(
  offer: MerchantOffer,
  siteUrl: string,
  locale: Locale,
  merchant: MerchantFeedSettings,
): string {
  const abs = (path: string) => toAbsolute(siteUrl, path)
  const link = abs(localizedPath(`/product/${offer.slug || offer.id}`, locale))
  const image = offer.image ? abs(offer.image) : null
  if (!image) return ''

  const additionalImages = offer.images
    .filter((img) => img && img !== offer.image)
    .slice(0, 10)
    .map((img) => `      <g:additional_image_link>${escapeXml(abs(img))}</g:additional_image_link>`)
    .join('\n')

  const availability = offer.isPreorder ? 'preorder' : 'in stock'
  const description = htmlToPlainText(offer.description ?? offer.name)
  const gtin = normalizeGtin(offer.barcode)
  const brand = offer.brand?.trim() || ''
  const sku = offer.sku?.trim() || ''

  const brandTag = brand ? `      <g:brand>${escapeXml(brand)}</g:brand>\n` : ''
  const gtinTag = gtin ? `      <g:gtin>${gtin}</g:gtin>\n` : ''
  const mpnTag = sku ? `      <g:mpn>${escapeXml(sku)}</g:mpn>\n` : ''
  const hasId = Boolean(gtin || (brand && sku))
  const identifierExists = hasId ? '' : '      <g:identifier_exists>no</g:identifier_exists>\n'

  const saleTag =
    offer.oldPrice && offer.oldPrice > offer.price
      ? `      <g:price>${priceTag(offer.oldPrice, offer.currency)}</g:price>\n      <g:sale_price>${priceTag(offer.price, offer.currency)}</g:sale_price>\n`
      : `      <g:price>${priceTag(offer.price, offer.currency)}</g:price>\n`

  const categoryTag = merchant.googleProductCategory.trim()
    ? `      <g:google_product_category>${escapeXml(merchant.googleProductCategory.trim())}</g:google_product_category>\n`
    : ''

  const shippingFormatted = formatShippingPrice(merchant.shippingPrice, offer.currency)
  const country = (merchant.shippingCountry || 'UA').trim().toUpperCase().slice(0, 2) || 'UA'
  const shippingTag = shippingFormatted
    ? `      <g:shipping>\n        <g:country>${escapeXml(country)}</g:country>\n        <g:price>${escapeXml(shippingFormatted)}</g:price>\n      </g:shipping>\n`
    : ''

  const weightFormatted = formatShippingWeightKg(offer.weight)
  const weightTag = weightFormatted
    ? `      <g:shipping_weight>${weightFormatted}</g:shipping_weight>\n`
    : ''

  const groupTag = offer.itemGroupId
    ? `      <g:item_group_id>${escapeXml(offer.itemGroupId)}</g:item_group_id>\n`
    : ''
  const colorTag = offer.color ? `      <g:color>${escapeXml(offer.color)}</g:color>\n` : ''
  const sizeTag = offer.size ? `      <g:size>${escapeXml(offer.size)}</g:size>\n` : ''

  return `    <item>
      <g:id>${escapeXml(offer.id)}</g:id>
${groupTag}      <title>${escapeXml(offer.name)}</title>
      <description>${escapeXml(description)}</description>
      <link>${escapeXml(link)}</link>
      <g:image_link>${escapeXml(image)}</g:image_link>
${additionalImages ? additionalImages + '\n' : ''}      <g:availability>${availability}</g:availability>
${saleTag}${brandTag}${gtinTag}${mpnTag}${identifierExists}${categoryTag}${shippingTag}${weightTag}${colorTag}${sizeTag}      <g:condition>new</g:condition>
    </item>`
}

export function buildMerchantRss(opts: {
  storeName: string
  storeDescription: string
  siteUrl: string
  itemsXml: string
}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(opts.storeName)}</title>
    <link>${escapeXml(opts.siteUrl)}</link>
    <description>${escapeXml(opts.storeDescription)}</description>
${opts.itemsXml}
  </channel>
</rss>
`
}
