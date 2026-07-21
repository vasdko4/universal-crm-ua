import type { MetadataRoute } from 'next'
import {
  getSitemapProducts,
  getSitemapCategories,
  getSitemapArticles,
  getSitemapPages,
} from '@/lib/shop/queries'
import { getCanonicalSiteUrl } from '@/lib/seo'
import { localizedPath } from '@/lib/i18n/config'

// Refresh the sitemap at most once per hour.
export const revalidate = 3600

type Entry = MetadataRoute.Sitemap[number]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  // Uses the domain configured in store settings (falls back to env/auto).
  const base = await getCanonicalSiteUrl()
  const abs = (path: string) => `${base}${path}`

  // The store is bilingual: 'uk' is served unprefixed (the default locale),
  // 'ru' under a /ru prefix (see proxy.ts). Every content URL below is listed
  // twice — once per language — each pointing at the other via
  // `alternates.languages` (hreflang) so search engines can index and rank
  // both language versions independently instead of only ever seeing
  // whichever one a stateless crawl request happens to render.
  function bilingual(path: string, rest: Omit<Entry, 'url' | 'alternates'>): Entry[] {
    const ukUrl = abs(path)
    const ruUrl = abs(localizedPath(path, 'ru'))
    const languages = { uk: ukUrl, ru: ruUrl, 'x-default': ukUrl }
    return [
      { ...rest, url: ukUrl, alternates: { languages } },
      { ...rest, url: ruUrl, alternates: { languages } },
    ]
  }

  const staticRoutes: MetadataRoute.Sitemap = [
    ...bilingual('/', { lastModified: now, changeFrequency: 'daily', priority: 1 }),
    ...bilingual('/catalog', { lastModified: now, changeFrequency: 'daily', priority: 0.9 }),
    ...bilingual('/articles', { lastModified: now, changeFrequency: 'weekly', priority: 0.6 }),
  ]

  const [products, categories, articleRows, pageRows] = await Promise.all([
    getSitemapProducts().catch(() => []),
    getSitemapCategories().catch(() => []),
    getSitemapArticles().catch(() => []),
    getSitemapPages().catch(() => []),
  ])

  const categoryRoutes: MetadataRoute.Sitemap = categories.flatMap((c) =>
    bilingual(`/category/${c.id}`, {
      lastModified: c.updatedAt ?? now,
      changeFrequency: 'weekly',
      priority: 0.7,
    }),
  )

  const productRoutes: MetadataRoute.Sitemap = products.flatMap((p) =>
    bilingual(`/product/${p.id}`, {
      lastModified: p.updatedAt ?? now,
      changeFrequency: 'weekly',
      priority: 0.8,
    }),
  )

  const articleRoutes: MetadataRoute.Sitemap = articleRows.flatMap((a) =>
    bilingual(`/articles/${a.slug}`, {
      lastModified: a.updatedAt ?? now,
      changeFrequency: 'monthly',
      priority: 0.5,
    }),
  )

  const pageRoutes: MetadataRoute.Sitemap = pageRows.flatMap((p) =>
    bilingual(`/p/${p.slug}`, {
      lastModified: p.updatedAt ?? now,
      changeFrequency: 'monthly',
      priority: 0.4,
    }),
  )

  return [...staticRoutes, ...categoryRoutes, ...productRoutes, ...articleRoutes, ...pageRoutes]
}
