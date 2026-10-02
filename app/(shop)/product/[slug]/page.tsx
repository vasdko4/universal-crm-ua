import { cache } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ProductTabs } from '@/components/shop/product-tabs'
import { ProductCard } from '@/components/shop/product-card'
import { FrequentlyBoughtTogether } from '@/components/shop/frequently-bought-together'
import { ProductPurchasePanel } from '@/components/shop/product-purchase-panel'
import { RecentlyViewed } from '@/components/shop/recently-viewed'
import { JsonLd } from '@/components/shop/json-ld'
import { ProductViewTracker } from '@/components/shop/analytics-tracker'
import { formatPrice } from '@/lib/shop/format'
import {
  getProductBySlug,
  getProductSlugById,
  getRelatedProducts,
  getFrequentlyBoughtTogether,
  getApprovedReviews,
  getAnsweredQuestions,
  getActiveDeliveryMethods,
  getActivePaymentMethods,
  getActiveGateways,
  getProductPromotionDeadline,
} from '@/lib/shop/queries'
import { getServerDictionary, getLocale } from '@/lib/i18n/server'
import { localizedPath } from '@/lib/i18n/config'
import { getCanonicalSiteUrl, toAbsolute, extractBrand, merchantReturnPolicy, shippingDetails, resolveOgImageUrl, buildBreadcrumbLd, buildFaqPageLd } from '@/lib/seo'
import { formatShippingPrice, normalizeGtin } from '@/lib/shop/google-merchant-feed'
import { getStoreSettingsInternal } from '@/lib/store-settings'
import { stripPromMarketplaceCopy } from '@/lib/prom-import/scraper'
import { storefrontMediaUrl, rewritePromHtmlImages } from '@/lib/shop/own-image-url'
import { stripTags } from '@/lib/text'
import { summarizeReviews } from '@/lib/shop/review-summary'

export const dynamic = 'force-dynamic'

// Deduped per request: generateMetadata and the page share a single DB read.
const loadProduct = cache((slug: string, locale: 'uk' | 'ru') => getProductBySlug(slug, locale))

function plainText(html: string | null, max = 160): string {
  if (!html) return ''
  const text = stripTags(html).replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

// Old links were `/product/<numeric id>` — keep them working by resolving to
// the current slug instead of 404ing bookmarks/backlinks/indexed search
// results from before this URL format existed.
async function resolveLegacyNumericSlug(slug: string, locale: 'uk' | 'ru'): Promise<never | void> {
  if (!/^\d+$/.test(slug)) return
  const resolved = await getProductSlugById(Number(slug)).catch(() => null)
  if (!resolved) notFound()
  redirect(localizedPath(`/product/${resolved}`, locale))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const locale = await getLocale()
  const data = await loadProduct(slug, locale).catch(() => null)
  if (!data) notFound()
  const { product } = data
  const title = stripPromMarketplaceCopy(product.metaTitle?.trim() || '') || product.name
  const description =
    stripPromMarketplaceCopy(product.metaDescription?.trim() || '') ||
    plainText(product.description) ||
    `${product.name} — купить с доставкой по Украине. ${formatPrice(product.price, product.currency, locale)}.`
  const path = `/product/${product.slug}`
  const canonical = localizedPath(path, locale)
  const siteUrl = await getCanonicalSiteUrl()
  const settings = await getStoreSettingsInternal().catch(() => null)
  const ogImage = resolveOgImageUrl(siteUrl, product.image, settings?.seo?.ogImageUrl)
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: { uk: path, ru: localizedPath(path, 'ru'), 'x-default': path },
    },
    openGraph: {
      type: 'website',
      title,
      description,
      url: canonical,
      images: [{ url: ogImage, alt: product.name }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
  }
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { locale, dict } = await getServerDictionary()

  const data = await loadProduct(slug, locale)
  if (!data) {
    await resolveLegacyNumericSlug(slug, locale)
    notFound()
  }

  const { product, characteristics, categories } = data
  const productId = product.id
  const brand = extractBrand(characteristics)
  const [related, boughtTogether, reviews, questions, settings, deliveryRows, paymentRows, gateways, promo] =
    await Promise.all([
      getRelatedProducts(productId, categories.map((c) => c.id), 4, locale, brand),
      getFrequentlyBoughtTogether(productId, 4, locale),
      getApprovedReviews(productId),
      getAnsweredQuestions(productId),
      getStoreSettingsInternal().catch(() => null),
      getActiveDeliveryMethods(),
      getActivePaymentMethods(),
      getActiveGateways(),
      getProductPromotionDeadline(productId, categories.map((c) => c.id)),
    ])
  // Single source of truth for the review count/average: derived from the same
  // approved-reviews array that renders the cards and the tab label (see
  // lib/shop/review-summary.ts). A separate aggregate query used to live in its
  // own cache entry and could disagree with the list (stale entry) — e.g. the
  // header showing "4.0 (3)" while the review cards rendered empty.
  const summary = summarizeReviews(reviews)
  const gaId = settings?.googleAds.gaEnabled ? settings.googleAds.gaMeasurementId : undefined

  // SECURITY: never forward the raw `config` column to the client (Nova
  // Poshta apiKey, bank IBAN/EDRPOU, gateway credentials) — same rule as
  // app/(shop)/checkout/page.tsx. Only code+name are safe to render as badges.
  const hasGateway = gateways.length > 0
  const deliveryMethods = deliveryRows.map((d) => ({ code: d.code, name: d.name }))
  const paymentMethods = paymentRows
    .filter((p) => (p.code === 'online' ? hasGateway : true))
    .map((p) => ({ code: p.code, name: p.name }))

  // Price stays valid until the end of next year — signals a stable offer.
  const priceValidUntil = `${new Date().getFullYear() + 1}-12-31`
  // Admin SEO settings (if configured) take priority over env vars, matching
  // the domain used by sitemap.xml / robots.txt / metadataBase.
  const siteUrl = await getCanonicalSiteUrl()
  const abs = (path: string) => toAbsolute(siteUrl, path)
  // Locale-prefixes an internal page path (not an asset URL — see images below).
  const lp = (path: string) => localizedPath(path, locale)
  // Gallery images improve product rich results; fall back to the main image.
  const images = (product.images.length ? product.images : [product.image || '/hero-electronics.png']).map((src) =>
    storefrontMediaUrl(siteUrl, src),
  )

  const gtin = normalizeGtin(product.barcode)
  const shippingPrice = formatShippingPrice(settings?.merchantFeed?.shippingPrice ?? '', product.currency)
  const shippingLd = shippingDetails(product.currency)
  if (shippingPrice) {
    const amount = Number(shippingPrice.split(' ')[0])
    shippingLd.shippingRate = { '@type': 'MonetaryAmount', value: amount, currency: product.currency }
  }

  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: images,
    description: plainText(product.description, 500) || product.name,
    ...(product.sku ? { sku: product.sku, mpn: product.sku } : {}),
    ...(gtin ? { gtin } : {}),
    ...(brand ? { brand: { '@type': 'Brand', name: brand } } : {}),
    offers: {
      '@type': 'Offer',
      priceCurrency: product.currency,
      price: product.price,
      priceValidUntil,
      itemCondition: 'https://schema.org/NewCondition',
      availability: product.isPreorder
        ? 'https://schema.org/PreOrder'
        : product.inStock
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      url: abs(lp(`/product/${product.slug}`)),
      hasMerchantReturnPolicy: merchantReturnPolicy(),
      shippingDetails: shippingLd,
    },
    ...(summary.count > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: Number(summary.avg.toFixed(1)),
            reviewCount: summary.count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    // Individual reviews (limited) enrich the product rich result.
    ...(reviews.length > 0
      ? {
          review: reviews.slice(0, 5).map((r) => ({
            '@type': 'Review',
            author: { '@type': 'Person', name: r.authorName },
            ...(r.createdAt ? { datePublished: new Date(r.createdAt).toISOString() } : {}),
            reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
            ...(r.body ? { reviewBody: r.body } : {}),
          })),
        }
      : {}),
  }

  const breadcrumbLd = buildBreadcrumbLd(
    [
      { name: dict.common.home, path: lp('/') },
      { name: dict.common.catalog, path: lp('/catalog') },
      ...(categories[0] ? [{ name: categories[0].name, path: lp(`/category/${categories[0].id}`) }] : []),
      { name: product.name, path: lp(`/product/${product.slug}`) },
    ],
    siteUrl,
  )

  // FAQ structured data from the Q&A section — improves product rich results.
  const faqLd = buildFaqPageLd(questions)

  return (
    <div className="mx-auto max-w-7xl px-3 py-3 sm:px-4 lg:px-8 lg:py-8">
      <JsonLd data={[productLd, breadcrumbLd, ...(faqLd ? [faqLd] : [])]} />
      <ProductViewTracker
        productId={product.id}
        slug={product.slug}
        gaId={gaId}
        name={product.name}
        price={product.price}
        sku={product.sku}
        currency={product.currency}
      />
      <nav className="mb-3 hidden flex-wrap items-center gap-y-1 text-xs text-muted-foreground lg:mb-6 lg:flex lg:text-sm">
        <Link href={lp('/')} className="hover:text-primary">{dict.common.home}</Link>
        <span className="mx-2">/</span>
        <Link href={lp('/catalog')} className="hover:text-primary">{dict.common.catalog}</Link>
        {categories[0] && (
          <>
            <span className="mx-2">/</span>
            <Link href={lp(`/category/${categories[0].id}`)} className="hover:text-primary">
              {categories[0].name}
            </Link>
          </>
        )}
      </nav>

      <ProductPurchasePanel
        product={product}
        reviewAvg={summary.avg}
        reviewCount={summary.count}
        labels={{
          locale,
          sku: dict.product.sku,
          inStock: dict.product.inStock,
          outOfStock: dict.product.outOfStock,
          noPhoto: locale === 'ru' ? 'Нет фото' : 'Немає фото',
        }}
        deliveryMethods={deliveryMethods}
        paymentMethods={paymentMethods}
        promo={promo}
      />

      {/* Tabs */}
      <div className="mt-6 lg:mt-12">
        <ProductTabs
          productId={product.id}
          description={product.description ? rewritePromHtmlImages(product.description, siteUrl) : product.description}
          characteristics={characteristics}
          reviews={reviews.map((r) => ({
            id: r.id,
            authorName: r.authorName,
            rating: r.rating,
            body: r.body,
            pros: r.pros,
            cons: r.cons,
            adminReply: r.adminReply,
            createdAt: r.createdAt,
          }))}
          questions={questions.map((q) => ({
            id: q.id,
            authorName: q.authorName,
            question: q.question,
            answer: q.answer,
            createdAt: q.createdAt,
          }))}
        />
      </div>

      {/* Frequently bought together — bundle builder with real co-purchase data */}
      {boughtTogether.length > 0 && (
        <FrequentlyBoughtTogether main={product} items={boughtTogether} />
      )}

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-8 lg:mt-14">
          <h2 className="mb-3 text-lg font-bold tracking-tight text-foreground lg:mb-5 lg:text-2xl">{dict.product.relatedProducts}</h2>
          <div className="product-grid">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      <RecentlyViewed productId={product.id} />
    </div>
  )
}
