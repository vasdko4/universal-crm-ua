import { cache } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CatalogToolbar } from '@/components/shop/catalog-toolbar'
import { InfiniteProducts } from '@/components/shop/infinite-products'
import { JsonLd } from '@/components/shop/json-ld'
import { getCatalogProducts, getCatalogFacets, getCategoryById, getPriceBounds, getShopCategories, type CatalogParams } from '@/lib/shop/queries'
import { parseCharFilters } from '@/lib/shop/catalog-search'
import { getServerDictionary, getLocale } from '@/lib/i18n/server'
import { localizedPath } from '@/lib/i18n/config'
import { getCanonicalSiteUrl, toAbsolute } from '@/lib/seo'

export const dynamic = 'force-dynamic'

const loadCategory = cache((id: number, locale: 'uk' | 'ru') => getCategoryById(id, locale))

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const categoryId = Number(id)
  if (!Number.isInteger(categoryId) || categoryId < 1) notFound()
  const locale = await getLocale()
  const category = await loadCategory(categoryId, locale).catch(() => null)
  if (!category) notFound()
  const description =
    category.description || `${category.name} — більший вибір з доставкою по всій Україні і гарантією.`
  const path = `/category/${category.id}`
  const canonical = localizedPath(path, locale)
  return {
    title: category.name,
    description,
    alternates: {
      canonical,
      languages: { uk: path, ru: localizedPath(path, 'ru'), 'x-default': path },
    },
    openGraph: { type: 'website', title: category.name, description, url: canonical },
  }
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const sp = await searchParams
  const { locale, dict } = await getServerDictionary()
  const categoryId = Number(id)
  if (!Number.isInteger(categoryId) || categoryId < 1) notFound()

  const category = await loadCategory(categoryId, locale)
  if (!category) notFound()

  const siteUrl = await getCanonicalSiteUrl()
  const abs = (path: string) => toAbsolute(siteUrl, path)
  const lp = (path: string) => localizedPath(path, locale)
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: dict.common.home, item: abs(lp('/')) },
      { '@type': 'ListItem', position: 2, name: dict.common.catalog, item: abs(lp('/catalog')) },
      { '@type': 'ListItem', position: 3, name: category.name, item: abs(lp(`/category/${category.id}`)) },
    ],
  }

  const get = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined
  const toPrice = (v: string | undefined) => {
    const n = Number(v)
    return v != null && Number.isFinite(n) && n >= 0 ? n : undefined
  }
  const catalogParams: CatalogParams = {
    categoryId,
    sort: (get('sort') as CatalogParams['sort']) ?? 'popular',
    inStockOnly: get('inStock') === '1',
    discountOnly: get('discount') === '1',
    minPrice: toPrice(get('minPrice')),
    maxPrice: toPrice(get('maxPrice')),
    charFilters: parseCharFilters(get('chars')),
    page: 1,
    perPage: 24,
    locale,
  }
  const [{ items, total, page, perPage }, priceBounds, facets, categories] = await Promise.all([
    getCatalogProducts(catalogParams),
    getPriceBounds({ categoryId, charFilters: catalogParams.charFilters }),
    getCatalogFacets({ categoryId, charFilters: catalogParams.charFilters }),
    getShopCategories(locale),
  ])
  const childCategories = categories.filter((c) => c.parentId === categoryId)

  // Product listing structured data helps this category surface in search.
  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: category.name,
    numberOfItems: items.length,
    itemListElement: items.map((p, i) => ({
      '@type': 'ListItem',
      position: (page - 1) * perPage + i + 1,
      url: abs(lp(`/product/${p.slug}`)),
      name: p.name,
    })),
  }

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 lg:px-8 lg:py-8">
      <JsonLd data={[breadcrumbLd, itemListLd]} />
      <nav className="mb-3 hidden text-sm text-muted-foreground lg:block">
        <Link href={lp('/')} className="hover:text-primary">{dict.common.home}</Link>
        <span className="mx-2">/</span>
        <Link href={lp('/catalog')} className="hover:text-primary">{dict.common.catalog}</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{category.name}</span>
      </nav>
      <h1 className="mb-2 text-xl font-bold tracking-tight text-foreground lg:text-3xl">{category.name}</h1>
      {category.description && (
        <p className="mb-4 max-w-2xl text-sm text-muted-foreground lg:mb-6">{category.description}</p>
      )}

      {childCategories.length > 0 && (
        <div className="-mx-3 mb-4 flex flex-nowrap gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:-mx-4 sm:px-4 lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden">
          {childCategories.map((cat) => (
            <Link
              key={cat.id}
              href={lp(`/category/${cat.id}`)}
              className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground"
            >
              {cat.name}
            </Link>
          ))}
        </div>
      )}

      <div className="space-y-6">
        <CatalogToolbar total={total} priceBounds={priceBounds} facets={facets} />
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-20 text-center">
            <p className="text-muted-foreground">{dict.catalog.nothingFound}</p>
          </div>
        ) : (
          <InfiniteProducts
            key={`${categoryId}|${catalogParams.sort}|${catalogParams.inStockOnly}|${catalogParams.discountOnly}|${catalogParams.minPrice ?? ''}|${catalogParams.maxPrice ?? ''}|${get('chars') ?? ''}`}
            initialItems={items}
            total={total}
            params={catalogParams}
          />
        )}
      </div>
    </div>
  )
}
