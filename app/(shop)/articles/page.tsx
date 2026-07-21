import type { Metadata } from 'next'
import Link from 'next/link'
import { getPublishedArticles, getPublishedArticleCategories } from '@/lib/shop/articles'
import { getServerDictionary } from '@/lib/i18n/server'
import { localizedPath } from '@/lib/i18n/config'
import { ArticleCard } from '@/components/shop/article-card'
import { JsonLd } from '@/components/shop/json-ld'
import { getCanonicalSiteUrl, toAbsolute } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const { dict, locale } = await getServerDictionary()
  return {
    title: dict.articles.title,
    description: dict.articles.subtitle,
    alternates: {
      canonical: localizedPath('/articles', locale),
      languages: { uk: '/articles', ru: localizedPath('/articles', 'ru'), 'x-default': '/articles' },
    },
  }
}

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const { category } = await searchParams
  const { dict, locale } = await getServerDictionary()
  const lp = (path: string) => localizedPath(path, locale)
  const [rawArticles, rawCategories] = await Promise.all([
    getPublishedArticles({ categorySlug: category }),
    getPublishedArticleCategories(),
  ])

  // Localize category labels by slug; fall back to the stored name.
  const localizedName = (slug: string, fallback: string) => dict.articles.categoryNames[slug] ?? fallback
  const categories = rawCategories.map((c) => ({ ...c, name: localizedName(c.slug, c.name) }))
  const slugById = new Map(rawCategories.map((c) => [c.id, c.slug]))
  const articles = rawArticles.map((a) => ({
    ...a,
    categoryName:
      a.categoryId != null && a.categoryName
        ? localizedName(slugById.get(a.categoryId) ?? '', a.categoryName)
        : a.categoryName,
  }))

  const [featured, ...rest] = articles

  const siteUrl = await getCanonicalSiteUrl()
  const abs = (path: string) => toAbsolute(siteUrl, path)
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: dict.common.home, item: abs(lp('/')) },
      { '@type': 'ListItem', position: 2, name: dict.articles.title, item: abs(lp('/articles')) },
    ],
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8 lg:py-12">
      <JsonLd data={breadcrumbLd} />
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground text-balance lg:text-4xl">
          {dict.articles.title}
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground text-pretty">{dict.articles.subtitle}</p>
      </header>

      {categories.length > 0 && (
        <nav className="mb-8 flex flex-wrap gap-2">
          <Link
            href={lp('/articles')}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              !category
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground hover:border-primary'
            }`}
          >
            {dict.articles.all}
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={lp(`/articles?category=${c.slug}`)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                category === c.slug
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground hover:border-primary'
              }`}
            >
              {c.name} <span className="opacity-60">({c.count})</span>
            </Link>
          ))}
        </nav>
      )}

      {articles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
          {dict.articles.empty}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {!category && featured && (
            <ArticleCard article={featured} minutesLabel={dict.articles.readMinutes} featured locale={locale} />
          )}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {(category ? articles : rest).map((a) => (
              <ArticleCard key={a.id} article={a} minutesLabel={dict.articles.readMinutes} locale={locale} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
