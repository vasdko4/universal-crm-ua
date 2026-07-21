import { cache } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ProductTabs } from '@/components/shop/product-tabs'
import { ProductCard } from '@/components/shop/product-card'
import { ProductPurchasePanel } from '@/components/shop/product-purchase-panel'
import { JsonLd } from '@/components/shop/json-ld'
import { ProductViewTracker } from '@/components/shop/analytics-tracker'
import { formatPrice } from '@/lib/shop/format'
import {
  getProductById,
  getRelatedProducts,
  getApprovedReviews,
  getAnsweredQuestions,
  getReviewSummary,
} from '@/lib/shop/queries'
import { getServerDictionary, getLocale } from '@/lib/i18n/server'
import { localizedPath } from '@/lib/i18n/config'
import { getCanonicalSiteUrl, toAbsolute, extractBrand, merchantReturnPolicy, shippingDetails } from '@/lib/seo'
import { getStoreSettingsInternal } from '@/lib/store-settings'

export const dynamic = 'force-dynamic'

// Deduped per request: generateMetadata and the page share a single DB read.
const loadProduct = cache((id: number, locale: 'uk' | 'ru') => getProductById(id, locale))
const loadSummary = cache((id: number) => getReviewSummary(id))

function plainText(html: string | null, max = 160): string {
  if (!html) return ''
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const productId = Number(id)
  if (!Number.isFinite(productId)) return {}
  const locale = await getLocale()
  const data = await loadProduct(productId, locale).catch(() => null)
  if (!data) return {}
  const { product } = data
  const description =
    plainText(product.description) ||
    `${product.name} — купить с доставкой по Украине. ${formatPrice(product.price, product.currency)}.`
  const path = `/product/${product.id}`
  const canonical = localizedPath(path, locale)
  const image = product.image || '/hero-electronics.png'
  return {
    title: product.name,
    description,
    alternates: {
      canonical,
      languages: { uk: path, ru: localizedPath(path, 'ru'), 'x-default': path },
    },
    openGraph: {
      type: 'website',
      title: product.name,
      description,
      url: canonical,
      images: [{ url: image, alt: product.name }],
    },
    twitter: { card: 'summary_large_image', title: product.name, description, images: [image] },
  }
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { locale, dict } = await getServerDictionary()
  const productId = Number(id)
  if (!Number.isFinite(productId)) notFound()

  const data = await loadProduct(productId, locale)
  if (!data) notFound()

  const { product, characteristics, categories } = data
  const [related, reviews, questions, summary, settings] = await Promise.all([
    getRelatedProducts(productId, categories.map((c) => c.id), 4, locale),
    getApprovedReviews(productId),
    getAnsweredQuestions(productId),
    loadSummary(productId),
    getStoreSettingsInternal().catch(() => null),
  ])
  const gaId = settings?.googleAds.gaEnabled ? settings.googleAds.gaMeasurementId : undefined

  const brand = extractBrand(characteristics)
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
    abs(src),
  )

  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: images,
    description: plainText(product.description, 500) || product.name,
    ...(product.sku ? { sku: product.sku, mpn: product.sku } : {}),
    ...(brand ? { brand: { '@type': 'Brand', name: brand } } : {}),
    offers: {
      '@type': 'Offer',
      priceCurrency: product.currency,
      price: product.price,
      priceValidUntil,
      itemCondition: 'https://schema.org/NewCondition',
      availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: abs(lp(`/product/${product.id}`)),
      hasMerchantReturnPolicy: merchantReturnPolicy(),
      shippingDetails: shippingDetails(product.currency),
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

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: dict.common.home, item: abs(lp('/')) },
      { '@type': 'ListItem', position: 2, name: dict.common.catalog, item: abs(lp('/catalog')) },
      ...(categories[0]
        ? [{ '@type': 'ListItem', position: 3, name: categories[0].name, item: abs(lp(`/category/${categories[0].id}`)) }]
        : []),
      {
        '@type': 'ListItem',
        position: categories[0] ? 4 : 3,
        name: product.name,
        item: abs(lp(`/product/${product.id}`)),
      },
    ],
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <JsonLd data={[
        productLd,
        breadcrumbLd,
        // FAQ structured data from the Q&A section — improves product rich results.
        ...(questions.length > 0
          ? [{
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: questions.map((q) => ({
                '@type': 'Question',
                name: q.question,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: q.answer,
                },
              })),
            }]
          : []),
      ]} />
      <ProductViewTracker
        productId={product.id}
        gaId={gaId}
        name={product.name}
        price={product.price}
        sku={product.sku}
        currency={product.currency}
      />
      <nav className="mb-6 flex flex-wrap items-center text-sm text-muted-foreground">
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
      />

      {/* Tabs */}
      <div className="mt-12">
        <ProductTabs
          productId={product.id}
          description={product.description}
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

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-5 text-2xl font-bold tracking-tight text-foreground">{dict.product.relatedProducts}</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
