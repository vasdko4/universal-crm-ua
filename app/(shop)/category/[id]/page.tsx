import { cache } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CatalogToolbar } from '@/components/shop/catalog-toolbar'
import { InfiniteProducts } from '@/components/shop/infinite-products'
import { JsonLd } from '@/components/shop/json-ld'
import { getCatalogProducts, getCategoryById, type CatalogParams } from '@/lib/shop/queries'
import { getServerDictionary, getLocale } from '@/lib/i18n/server'
import { localizedPath } from '@/lib/i18n/config'
import { getCanonicalSiteUrl, toAbsolute } from '@/lib/seo'

export const dynamic = 'force-dynamic'

const loadCategory = cache((id: number, locale: 'uk' | 'ru') => getCategoryById(id, locale))

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const categoryId = Number(id)
  if (!Number.isFinite(categoryId)) return {}
  const locale = await getLocale()
  const category = await loadCategory(categoryId, locale).catch(() => null)
  if (!category) return {}
  const description =
    category.description || `${category.name} — большой выбор с доставкой по всей Украине и гарантией.`
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
  if (!Number.isFinite(categoryId)) notFound()

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
    page: 1,
    perPage: 12,
    locale,
  }
  const { items, total, page, perPage } = await getCatalogProducts(catalogParams)

  // Product listing structured data helps this category surface in search.
  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: category.name,
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
        <Link href={lp('/catalog')} className="hover:text-primary">{dict.common.catalog}</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{category.name}</span>
      </nav>
      <h1 className="mb-2 text-3xl font-bold tracking-tight text-foreground">{category.name}</h1>
      {category.description && (
        <p className="mb-6 max-w-2xl text-muted-foreground">{category.description}</p>
      )}

      <div className="space-y-6">
        <CatalogToolbar total={total} />
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-20 text-center">
            <p className="text-muted-foreground">{dict.catalog.nothingFound}</p>
          </div>
        ) : (
          <InfiniteProducts
            key={`${categoryId}|${catalogParams.sort}|${catalogParams.inStockOnly}|${catalogParams.discountOnly}|${catalogParams.minPrice ?? ''}|${catalogParams.maxPrice ?? ''}`}
            initialItems={items}
            total={total}
            params={catalogParams}
          />
        )}
      </div>
    </div>
  )
}
