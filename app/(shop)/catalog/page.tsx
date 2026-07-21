import type { Metadata } from 'next'
import Link from 'next/link'
import { CatalogToolbar } from '@/components/shop/catalog-toolbar'
import { InfiniteProducts } from '@/components/shop/infinite-products'
import { CatalogCategoriesMobile } from '@/components/shop/catalog-categories-mobile'
import { JsonLd } from '@/components/shop/json-ld'
import { getCatalogProducts, getShopCategories, type CatalogParams } from '@/lib/shop/queries'
import { getServerDictionary, getLocale } from '@/lib/i18n/server'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { localizedPath } from '@/lib/i18n/config'
import { getCanonicalSiteUrl, toAbsolute } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<Metadata> {
  const locale = await getLocale()
  const dict = getDictionary(locale)
  const sp = await searchParams
  const get = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined
  // Search, filter and paginated views are near-duplicates of the canonical
  // catalog — keep them out of the index while still following links.
  const isFiltered = Boolean(get('search') || get('inStock')) || Number(get('page') ?? 1) > 1
  const search = get('search')
  const title = search ? `${dict.catalog.resultsFor}: «${search}»` : dict.catalog.title
  return {
    title,
    description:
      locale === 'ru'
        ? 'Полный каталог электроники: смартфоны, наушники, аудио и аксессуары с доставкой по Украине.'
        : 'Повний каталог електроніки: смартфони, навушники, аудіо та аксесуари з доставкою по Україні.',
    alternates: {
      canonical: localizedPath('/catalog', locale),
      languages: { uk: '/catalog', ru: localizedPath('/catalog', 'ru'), 'x-default': '/catalog' },
    },
    ...(isFiltered ? { robots: { index: false, follow: true } } : {}),
  }
}

function parseParams(sp: Record<string, string | string[] | undefined>): CatalogParams {
  const get = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined
  const sort = get('sort') as CatalogParams['sort']
  const toPrice = (v: string | undefined) => {
    const n = Number(v)
    return v != null && Number.isFinite(n) && n >= 0 ? n : undefined
  }
  return {
    search: get('search'),
    sort: sort ?? 'popular',
    inStockOnly: get('inStock') === '1',
    discountOnly: get('discount') === '1',
    popularOnly: get('popular') === '1',
    minPrice: toPrice(get('minPrice')),
    maxPrice: toPrice(get('maxPrice')),
    page: Number(get('page') ?? 1),
    perPage: 12,
  }
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const { locale, dict } = await getServerDictionary()
  const params = { ...parseParams(sp), page: 1 }
  const [{ items, total, page, perPage }, categories] = await Promise.all([
    getCatalogProducts({ ...params, locale }),
    getShopCategories(locale),
  ])
  // On mobile the catalog acts as a category directory; the product grid is
  // shown on mobile only when the user is searching or filtering.
  const showCategoriesOnMobile =
    !params.search &&
    !params.inStockOnly &&
    !params.discountOnly &&
    !params.popularOnly &&
    params.minPrice == null &&
    params.maxPrice == null

  // Admin SEO settings (if configured) take priority over env vars, matching
  // the domain used by sitemap.xml / robots.txt / metadataBase.
  const siteUrl = await getCanonicalSiteUrl()
  const abs = (path: string) => toAbsolute(siteUrl, path)
  const lp = (path: string) => localizedPath(path, locale)
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: dict.common.home, item: abs(lp('/')) },
      { '@type': 'ListItem', position: 2, name: dict.common.catalog, item: abs(lp('/catalog')) },
    ],
  }
  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: items.length,
    itemListElement: items.map((p, i) => ({
      '@type': 'ListItem',
      position: (page - 1) * perPage + i + 1,
      url: abs(lp(`/product/${p.id}`)),
      name: p.name,
    })),
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <JsonLd data={[breadcrumbLd, itemListLd]} />
      <nav className="mb-4 text-sm text-muted-foreground">
        <Link href={lp('/')} className="hover:text-primary">{dict.common.home}</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{dict.common.catalog}</span>
      </nav>
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-foreground">
        {params.search
          ? `${dict.catalog.resultsFor}: «${params.search}»`
          : params.popularOnly
            ? dict.home.popular
            : dict.catalog.title}
      </h1>

      {showCategoriesOnMobile && (
        <CatalogCategoriesMobile
          categories={categories}
          locale={locale}
          className="flex flex-col gap-3 lg:hidden"
        />
      )}

      <div className={showCategoriesOnMobile ? 'hidden space-y-6 lg:block' : 'space-y-6'}>
        <CatalogToolbar total={total} />

        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-20 text-center">
            <p className="text-muted-foreground">{dict.catalog.nothingFound}</p>
          </div>
        ) : (
          <InfiniteProducts
            key={`${params.search ?? ''}|${params.sort}|${params.inStockOnly}|${params.discountOnly}|${params.popularOnly}|${params.minPrice ?? ''}|${params.maxPrice ?? ''}`}
            initialItems={items}
            total={total}
            params={{ ...params, page: undefined, perPage, locale }}
          />
        )}
      </div>
    </div>
  )
}
