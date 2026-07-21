import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { ArrowLeft, Clock, User } from 'lucide-react'
import DOMPurify from 'isomorphic-dompurify'
import { getArticleBySlug, getRelatedArticles } from '@/lib/shop/articles'
import { getServerDictionary } from '@/lib/i18n/server'
import { localizedPath } from '@/lib/i18n/config'
import { ArticleCard } from '@/components/shop/article-card'
import { JsonLd } from '@/components/shop/json-ld'
import { getStoreSettingsInternal } from '@/lib/store-settings'
import { canonicalUrl, getCanonicalSiteUrl } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const { locale } = await getServerDictionary()
  const article = await getArticleBySlug(slug)
  if (!article) return { title: 'Not found', robots: { index: false } }
  const path = `/articles/${slug}`
  return {
    title: article.metaTitle || article.title,
    description: article.metaDescription || article.excerpt || undefined,
    alternates: {
      canonical: await canonicalUrl(localizedPath(path, locale)),
      languages: { uk: path, ru: localizedPath(path, 'ru'), 'x-default': path },
    },
    openGraph: {
      title: article.metaTitle || article.title,
      description: article.metaDescription || article.excerpt || undefined,
      type: 'article',
      images: article.coverImage ? [article.coverImage] : undefined,
    },
  }
}

export default async function ArticleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { dict, locale } = await getServerDictionary()
  const lp = (p: string) => localizedPath(p, locale)
  const article = await getArticleBySlug(slug)
  if (!article) notFound()

  const [relatedRaw, settings] = await Promise.all([
    getRelatedArticles(article.id, article.categoryId),
    getStoreSettingsInternal().catch(() => null),
  ])

  // Localize category labels by slug; fall back to the stored name.
  const categoryLabel =
    article.categoryName && article.categorySlug
      ? (dict.articles.categoryNames[article.categorySlug] ?? article.categoryName)
      : article.categoryName
  // Related articles share the same category, so reuse the localized label.
  const related = relatedRaw.map((a) => ({
    ...a,
    categoryName: a.categoryId === article.categoryId && a.categoryName ? categoryLabel : a.categoryName,
  }))

  const date = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })
    : null
  const tags = Array.isArray(article.tags) ? (article.tags as string[]) : []

  const publishedIso = article.publishedAt ? new Date(article.publishedAt).toISOString() : undefined
  const storeName = settings?.storeName || 'Интернет-магазин электроники'
  // Resolve the site origin once (admin SEO settings take priority over env
  // vars) so canonical links, JSON-LD and OG data all agree on the same
  // domain — important right after a fresh install under a custom domain.
  const siteUrl = await getCanonicalSiteUrl()
  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.excerpt || undefined,
    image: article.coverImage ? [await canonicalUrl(article.coverImage)] : undefined,
    author: { '@type': article.author ? 'Person' : 'Organization', name: article.author || storeName },
    publisher: {
      '@type': 'Organization',
      name: storeName,
      logo: { '@type': 'ImageObject', url: await canonicalUrl(settings?.logoUrl || '/hero-electronics.png') },
    },
    datePublished: publishedIso,
    dateModified: publishedIso,
    mainEntityOfPage: { '@type': 'WebPage', '@id': await canonicalUrl(lp(`/articles/${slug}`)) },
    url: siteUrl + lp(`/articles/${slug}`),
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-8 lg:py-12">
      <JsonLd data={articleLd} />
      <Link
        href={lp('/articles')}
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" /> {dict.articles.backToList}
      </Link>

      <article>
        {categoryLabel ? (
          <Link
            href={lp(`/articles?category=${article.categorySlug}`)}
            className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/20"
          >
            {categoryLabel}
          </Link>
        ) : null}

        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground text-balance lg:text-4xl">
          {article.title}
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {article.author ? (
            <span className="flex items-center gap-1.5">
              <User className="size-4" /> {article.author}
            </span>
          ) : null}
          {date ? <span>{date}</span> : null}
          <span className="flex items-center gap-1.5">
            <Clock className="size-4" /> {article.readingMinutes} {dict.articles.readMinutes}
          </span>
        </div>

        {article.coverImage ? (
          <div className="relative mt-6 aspect-[16/9] w-full overflow-hidden rounded-2xl border border-border bg-muted">
            <Image
              src={article.coverImage || '/placeholder.svg'}
              alt={article.title}
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
              priority
            />
          </div>
        ) : null}

        {article.excerpt ? (
          <p className="mt-6 text-lg font-medium leading-relaxed text-muted-foreground text-pretty">
            {article.excerpt}
          </p>
        ) : null}

        <div
          className="prose prose-neutral mt-6 max-w-none text-pretty leading-relaxed text-foreground [&_a]:text-primary [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold [&_img]:rounded-xl [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.content || '') }}
        />

        {tags.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2 border-t border-border pt-6">
            {tags.map((tag) => (
              <span key={tag} className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </article>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-5 text-xl font-bold text-foreground">{dict.articles.related}</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {related.map((a) => (
              <ArticleCard key={a.id} article={a} minutesLabel={dict.articles.readMinutes} locale={locale} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
