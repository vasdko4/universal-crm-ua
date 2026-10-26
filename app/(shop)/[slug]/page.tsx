import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import sanitizeHtml from 'sanitize-html'
import { RICH_TEXT_SANITIZE_OPTIONS } from '@/lib/shop/sanitize'
import { getPageBySlug } from '@/lib/shop/pages'
import { getProductBySlug } from '@/lib/shop/queries'
import { getServerDictionary } from '@/lib/i18n/server'
import { localizedPath } from '@/lib/i18n/config'
import { canonicalUrl, getCanonicalSiteUrl } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const { locale } = await getServerDictionary()
  const page = await getPageBySlug(slug, locale)
  if (!page) {
    // Legacy /p/<product-slug> links land here through the proxy's /p/ → /<slug>
    // canonicalization, and a product slug has no info page — so send it on to
    // the canonical product URL (permanent, so Google updates the indexed URL)
    // instead of a dead 404. Slugs matching neither a page nor a product
    // still 404 for real.
    const data = await getProductBySlug(slug, locale).catch(() => null)
    if (data) redirect(localizedPath(`/product/${data.product.slug || slug}`, locale), 'replace')
    notFound()
  }
  const path = `/${slug}`
  const siteUrl = await getCanonicalSiteUrl()
  return {
    title: page.title,
    alternates: {
      canonical: await canonicalUrl(localizedPath(path, locale)),
      languages: { uk: path, ru: localizedPath(path, 'ru'), 'x-default': path },
    },
    openGraph: {
      title: page.title,
      type: 'website',
      url: `${siteUrl}${localizedPath(path, locale)}`,
    },
  }
}

export default async function InfoPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { dict, locale } = await getServerDictionary()
  const page = await getPageBySlug(slug, locale)
  if (!page) {
    // Same fallback as in generateMetadata: a product slug has no info page,
    // so a legacy /p/<product-slug> link (via the proxy's /p/ → /<slug> hop)
    // goes on to the canonical product URL instead of a dead 404.
    const data = await getProductBySlug(slug, locale).catch(() => null)
    if (data) redirect(localizedPath(`/product/${data.product.slug || slug}`, locale), 'replace')
    notFound()
  }

  const html = sanitizeHtml(page.content || '', RICH_TEXT_SANITIZE_OPTIONS)

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">{page.title}</h1>
      <div
        className="prose prose-sm max-w-none sm:prose-base dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
