import 'server-only'
import { unstable_cache } from 'next/cache'
import { and, asc, desc, eq, ilike, inArray, ne, or, sql } from 'drizzle-orm'
import type { Locale } from '@/lib/i18n/config'
import { db } from '@/lib/db'
import {
  products,
  productVariants,
  categories,
  productCategory,
  productCharacteristics,
  productReviews,
  productQuestions,
  deliveryMethods,
  paymentMethods,
  paymentGateways,
  articles,
  pages,
} from '@/lib/db/schema'
import type { ProductOption, VariantOptions } from '@/lib/db/schema'

export type { ProductOption, VariantOptions } from '@/lib/db/schema'

/**
 * Cache tags for storefront reads. Admin mutations call `revalidateStorefront()`
 * (see lib/shop/cache.ts) to bust these instantly; otherwise cached entries
 * self-refresh after `STOREFRONT_TTL` seconds. This keeps the read-heavy
 * storefront serving from cache under load instead of hitting Postgres on every
 * request, while still reflecting admin edits quickly.
 */
export const CACHE_TAGS = {
  catalog: 'shop:catalog',
  categories: 'shop:categories',
  product: (id: number) => `shop:product:${id}`,
  reviews: 'shop:reviews',
  checkout: 'shop:checkout',
}
// Seconds a cached storefront query stays fresh before a background refresh.
const STOREFRONT_TTL = 60

export type ProductVariant = {
  id: number
  options: VariantOptions
  sku: string | null
  price: number
  oldPrice: number | null
  quantity: number
  inStock: boolean
  image: string | null
}

export type ShopProduct = {
  id: number
  name: string
  slug: string
  description: string | null
  price: number
  oldPrice: number | null
  currency: string
  quantity: number
  inStock: boolean
  stockStatus: string | null
  image: string | null
  images: string[]
  sizes: string[]
  options: ProductOption[]
  variants: ProductVariant[]
  isPopular: boolean
  sku: string | null
  /** Displayed purchase count: real orders + admin-set boost. */
  purchasedCount: number
}

function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string' && x.length > 0)
  if (typeof v === 'string' && v.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(v)
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
    } catch {
      return []
    }
  }
  return []
}

function toOptions(v: unknown): ProductOption[] {
  let arr: unknown = v
  if (typeof v === 'string' && v.trim().startsWith('[')) {
    try {
      arr = JSON.parse(v)
    } catch {
      return []
    }
  }
  if (!Array.isArray(arr)) return []
  return arr
    .filter((o): o is ProductOption => !!o && typeof o === 'object' && Array.isArray((o as ProductOption).values))
    .map((o) => ({
      name: String(o.name ?? ''),
      type: o.type === 'color' ? 'color' : 'text',
      values: o.values.filter((x): x is string => typeof x === 'string'),
      swatches: o.swatches && typeof o.swatches === 'object' ? o.swatches : undefined,
    }))
}

function toShopProduct(r: Record<string, unknown>): ShopProduct {
  const price = Number(r.price ?? 0)
  const oldPrice = r.old_price != null ? Number(r.old_price) : null
  const quantity = Number(r.quantity ?? 0)
  const gallery = toStringArray(r.images)
  return {
    id: Number(r.id),
    name: (r.name as string) ?? 'Товар',
    slug: `${r.id}`,
    description: (r.description as string) ?? null,
    price,
    oldPrice: oldPrice && oldPrice > price ? oldPrice : null,
    currency: (r.currency as string) ?? 'UAH',
    quantity,
    inStock: Boolean(r.is_in_stock) && quantity > 0,
    stockStatus: (r.stock_status as string) ?? null,
    image: (r.image as string) ?? null,
    images: gallery,
    sizes: toStringArray(r.sizes),
    options: toOptions(r.options),
    variants: [],
    isPopular: Boolean(r.is_popular),
    sku: (r.sku as string) ?? null,
    purchasedCount: Number(r.orders_count ?? 0) + Number(r.purchases_boost ?? 0),
  }
}

function buildProductSelect(locale: Locale = 'uk') {
  const name =
    locale === 'ru'
      ? sql<string>`COALESCE(NULLIF(${products.nameRu}, ''), ${products.nameUk})`
      : sql<string>`COALESCE(NULLIF(${products.nameUk}, ''), ${products.nameRu})`
  const description =
    locale === 'ru'
      ? sql<string>`COALESCE(NULLIF(${products.descriptionRu}, ''), ${products.descriptionUk})`
      : sql<string>`COALESCE(NULLIF(${products.descriptionUk}, ''), ${products.descriptionRu})`
  return {
    id: products.id,
    name,
    description,
    price: products.price,
    old_price: products.oldPrice,
    currency: products.currency,
    quantity: products.quantity,
    is_in_stock: products.isInStock,
    stock_status: products.stockStatus,
    image: products.image,
    images: products.images,
    sizes: products.sizes,
    options: products.options,
    is_popular: products.isPopular,
    sku: products.sku,
    orders_count: products.ordersCount,
    purchases_boost: products.purchasesBoost,
  }
}

const baseWhere = and(sql`${products.deletedAt} IS NULL`, eq(products.isVisible, true))

export type CatalogParams = {
  categoryId?: number
  search?: string
  sort?: 'popular' | 'price_asc' | 'price_desc' | 'new'
  minPrice?: number
  maxPrice?: number
  inStockOnly?: boolean
  discountOnly?: boolean
  /** Only products manually marked as popular in the admin center. */
  popularOnly?: boolean
  page?: number
  perPage?: number
  locale?: Locale
}

export function getCatalogProducts(params: CatalogParams = {}) {
  return unstable_cache(() => _getCatalogProducts(params), ['catalog', JSON.stringify(params)], {
    tags: [CACHE_TAGS.catalog],
    revalidate: STOREFRONT_TTL,
  })()
}

async function _getCatalogProducts(params: CatalogParams = {}) {
  const page = Math.max(1, params.page ?? 1)
  const perPage = params.perPage ?? 12
  const productSelect = buildProductSelect(params.locale ?? 'uk')
  const conditions = [baseWhere]

  if (params.search) {
    const s = `%${params.search}%`
    conditions.push(or(ilike(products.nameRu, s), ilike(products.nameUk, s), ilike(products.sku, s))!)
  }
  if (params.minPrice != null) conditions.push(sql`${products.price} >= ${params.minPrice}`)
  if (params.maxPrice != null) conditions.push(sql`${products.price} <= ${params.maxPrice}`)
  if (params.inStockOnly) conditions.push(sql`${products.quantity} > 0`)
  if (params.discountOnly)
    conditions.push(sql`${products.oldPrice} IS NOT NULL AND ${products.oldPrice} > ${products.price}`)

  // "Popular" is meant to be manually curated (admin center), but imports
  // (e.g. Prom.ua) never set this flag, so a strict filter here would leave
  // the "Популярные" link on the homepage pointing at an empty page even
  // though the homepage widget itself always shows something (it falls back
  // to newest products — see _getPopularProducts below). Mirror that same
  // fallback here so the two stay consistent: only apply the strict filter
  // if at least one product is actually marked popular.
  let popularFallback = false
  if (params.popularOnly) {
    const anyPopular = await db
      .select({ id: products.id })
      .from(products)
      .where(and(baseWhere, eq(products.isPopular, true)))
      .limit(1)
    if (anyPopular.length > 0) {
      conditions.push(eq(products.isPopular, true))
    } else {
      popularFallback = true
    }
  }

  let idFilter: number[] | null = null
  if (params.categoryId) {
    // A category page should also include products filed under any of its
    // descendant (sub)categories — the Prom.ua import (and manual category
    // creation) only ever attaches products to the leaf category of a
    // breadcrumb chain, so a parent category would otherwise always render
    // empty even though it visibly "contains" those products in the UI.
    const categoryIds = await getCategoryAndDescendantIds(params.categoryId)
    const rows = await db
      .select({ pid: productCategory.productId })
      .from(productCategory)
      .where(inArray(productCategory.categoryId, categoryIds))
    idFilter = rows.map((r) => r.pid)
    if (idFilter.length === 0) return { items: [], total: 0, page, perPage }
    conditions.push(inArray(products.id, idFilter))
  }

  const where = and(...conditions)
  const orderBy =
    params.sort === 'price_asc'
      ? asc(products.price)
      : params.sort === 'price_desc'
        ? desc(products.price)
        : params.sort === 'new'
          ? desc(products.createdAt)
          : popularFallback
            ? desc(products.createdAt)
            : [
                desc(products.isPopular),
                desc(sql`${products.ordersCount} + ${products.purchasesBoost}`),
              ]

  const [rows, countRes] = await Promise.all([
    db
      .select(productSelect)
      .from(products)
      .where(where)
      .orderBy(...(Array.isArray(orderBy) ? orderBy : [orderBy]))
      .limit(perPage)
      .offset((page - 1) * perPage),
    db.select({ c: sql<number>`count(*)::int` }).from(products).where(where),
  ])

  return {
    items: rows.map((r) => toShopProduct(r as Record<string, unknown>)),
    total: countRes[0]?.c ?? 0,
    page,
    perPage,
  }
}

export function getPopularProducts(limit = 8, locale: Locale = 'uk') {
  return unstable_cache(() => _getPopularProducts(limit, locale), ['popular', String(limit), locale], {
    tags: [CACHE_TAGS.catalog],
    revalidate: STOREFRONT_TTL,
  })()
}

async function _getPopularProducts(limit = 8, locale: Locale = 'uk') {
  const productSelect = buildProductSelect(locale)
  const rows = await db
    .select(productSelect)
    .from(products)
    .where(and(baseWhere, eq(products.isPopular, true)))
    .orderBy(desc(sql`${products.ordersCount} + ${products.purchasesBoost}`))
    .limit(limit)
  if (rows.length > 0) return rows.map((r) => toShopProduct(r as Record<string, unknown>))
  // Fallback: newest products if nothing marked popular.
  const fallback = await db
    .select(productSelect)
    .from(products)
    .where(baseWhere)
    .orderBy(desc(products.createdAt))
    .limit(limit)
  return fallback.map((r) => toShopProduct(r as Record<string, unknown>))
}

// Fetch a set of visible products by id, preserving the given id order
// (used by the favorites page which orders by most-recently-added).
export async function getProductsByIds(ids: number[], locale: Locale = 'uk') {
  const clean = Array.from(new Set(ids.filter((n) => Number.isInteger(n) && n > 0)))
  if (clean.length === 0) return []
  const productSelect = buildProductSelect(locale)
  const rows = await db
    .select(productSelect)
    .from(products)
    .where(and(baseWhere, inArray(products.id, clean)))
  const mapped = rows.map((r) => toShopProduct(r as Record<string, unknown>))
  const order = new Map(clean.map((id, i) => [id, i]))
  return mapped.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
}

export type FeedProduct = ShopProduct & { brand: string | null }

// Bulk data for the Google Merchant Center feed (app/feed/google-merchant.xml).
// Two queries total regardless of catalog size — products, then every
// characteristic row for those ids in one shot — instead of one extra
// characteristics query per product (extractBrand() re-used from lib/seo.ts,
// same brand-detection logic as the product page's structured data).
export async function getFeedProducts(locale: Locale = 'uk', limit = 5000): Promise<FeedProduct[]> {
  const { extractBrand } = await import('@/lib/seo')
  const productSelect = buildProductSelect(locale)
  const rows = await db
    .select(productSelect)
    .from(products)
    .where(baseWhere)
    .orderBy(asc(products.id))
    .limit(limit)
  const mapped = rows.map((r) => toShopProduct(r as Record<string, unknown>))
  if (mapped.length === 0) return []

  const ids = mapped.map((p) => p.id)
  const charRows = await db
    .select({
      productId: productCharacteristics.productId,
      name: productCharacteristics.name,
      value: productCharacteristics.value,
    })
    .from(productCharacteristics)
    .where(inArray(productCharacteristics.productId, ids))

  const charsByProduct = new Map<number, { name: string; value: string }[]>()
  for (const c of charRows) {
    const arr = charsByProduct.get(c.productId) ?? []
    arr.push({ name: c.name, value: c.value })
    charsByProduct.set(c.productId, arr)
  }

  return mapped.map((p) => ({ ...p, brand: extractBrand(charsByProduct.get(p.id) ?? []) }))
}

export function getDiscountedProducts(limit = 8, locale: Locale = 'uk') {
  return unstable_cache(() => _getDiscountedProducts(limit, locale), ['discounted', String(limit), locale], {
    tags: [CACHE_TAGS.catalog],
    revalidate: STOREFRONT_TTL,
  })()
}

async function _getDiscountedProducts(limit = 8, locale: Locale = 'uk') {
  const productSelect = buildProductSelect(locale)
  const rows = await db
    .select(productSelect)
    .from(products)
    .where(and(baseWhere, sql`${products.oldPrice} IS NOT NULL AND ${products.oldPrice} > ${products.price}`))
    .orderBy(desc(products.updatedAt))
    .limit(limit)
  return rows.map((r) => toShopProduct(r as Record<string, unknown>))
}

export function getProductById(id: number, locale: Locale = 'uk') {
  return unstable_cache(() => _getProductById(id, locale), ['product', String(id), locale], {
    tags: [CACHE_TAGS.catalog, CACHE_TAGS.product(id)],
    revalidate: STOREFRONT_TTL,
  })()
}

async function _getProductById(id: number, locale: Locale = 'uk') {
  const productSelect = buildProductSelect(locale)
  const catName =
    locale === 'ru'
      ? sql<string>`COALESCE(NULLIF(${categories.nameRu}, ''), ${categories.nameUk})`
      : sql<string>`COALESCE(NULLIF(${categories.nameUk}, ''), ${categories.nameRu})`
  const [row] = await db.select(productSelect).from(products).where(and(eq(products.id, id), baseWhere)).limit(1)
  if (!row) return null
  const [chars, cats, variantRows] = await Promise.all([
    db
      .select({ name: productCharacteristics.name, value: productCharacteristics.value })
      .from(productCharacteristics)
      .where(eq(productCharacteristics.productId, id))
      .orderBy(asc(productCharacteristics.sortOrder)),
    db
      .select({ id: categories.id, name: catName, slug: categories.slug })
      .from(productCategory)
      .innerJoin(categories, eq(productCategory.categoryId, categories.id))
      .where(eq(productCategory.productId, id)),
    db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, id))
      .orderBy(asc(productVariants.sortOrder), asc(productVariants.id)),
  ])
  const product = toShopProduct(row as Record<string, unknown>)
  product.variants = variantRows.map((v) => {
    const vq = Number(v.quantity ?? 0)
    const vp = Number(v.price ?? 0)
    const vop = v.oldPrice != null ? Number(v.oldPrice) : null
    return {
      id: v.id,
      options: (v.options ?? {}) as VariantOptions,
      sku: v.sku ?? null,
      price: vp,
      oldPrice: vop && vop > vp ? vop : null,
      quantity: vq,
      inStock: Boolean(v.isInStock) && vq > 0,
      image: v.image ?? null,
    }
  })
  return {
    product,
    characteristics: chars,
    categories: cats,
  }
}

export function getRelatedProducts(id: number, categoryIds: number[], limit = 4, locale: Locale = 'uk') {
  return unstable_cache(
    () => _getRelatedProducts(id, categoryIds, limit, locale),
    ['related', String(id), categoryIds.join('-'), String(limit), locale],
    { tags: [CACHE_TAGS.catalog], revalidate: STOREFRONT_TTL },
  )()
}

async function _getRelatedProducts(id: number, categoryIds: number[], limit = 4, locale: Locale = 'uk') {
  const productSelect = buildProductSelect(locale)
  if (categoryIds.length === 0) {
    const rows = await db
      .select(productSelect)
      .from(products)
      .where(and(baseWhere, ne(products.id, id)))
      .orderBy(desc(products.isPopular))
      .limit(limit)
    return rows.map((r) => toShopProduct(r as Record<string, unknown>))
  }
  const related = await db
    .selectDistinct({ pid: productCategory.productId })
    .from(productCategory)
    .where(and(inArray(productCategory.categoryId, categoryIds), ne(productCategory.productId, id)))
    .limit(20)
  const ids = related.map((r) => r.pid)
  if (ids.length === 0) return []
  const rows = await db
    .select(productSelect)
    .from(products)
    .where(and(baseWhere, inArray(products.id, ids)))
    .limit(limit)
  return rows.map((r) => toShopProduct(r as Record<string, unknown>))
}

export function getApprovedReviews(productId: number) {
  return unstable_cache(
    () =>
      db
        .select()
        .from(productReviews)
        .where(and(eq(productReviews.productId, productId), eq(productReviews.status, 'approved')))
        .orderBy(desc(productReviews.createdAt)),
    ['reviews', String(productId)],
    { tags: [CACHE_TAGS.reviews], revalidate: STOREFRONT_TTL },
  )()
}

export function getAnsweredQuestions(productId: number) {
  return unstable_cache(
    () =>
      db
        .select()
        .from(productQuestions)
        .where(and(eq(productQuestions.productId, productId), eq(productQuestions.status, 'approved')))
        .orderBy(desc(productQuestions.createdAt)),
    ['questions', String(productId)],
    { tags: [CACHE_TAGS.reviews], revalidate: STOREFRONT_TTL },
  )()
}

export function getReviewSummary(productId: number) {
  return unstable_cache(
    async () => {
      const res = await db
        .select({
          count: sql<number>`count(*)::int`,
          avg: sql<number>`COALESCE(AVG(${productReviews.rating}), 0)::float`,
        })
        .from(productReviews)
        .where(and(eq(productReviews.productId, productId), eq(productReviews.status, 'approved')))
      return { count: res[0]?.count ?? 0, avg: res[0]?.avg ?? 0 }
    },
    ['review-summary', String(productId)],
    { tags: [CACHE_TAGS.reviews], revalidate: STOREFRONT_TTL },
  )()
}

export function getShopCategories(locale: Locale = 'uk') {
  return unstable_cache(() => _getShopCategories(locale), ['shop-categories', locale], {
    tags: [CACHE_TAGS.categories],
    revalidate: 300,
  })()
}

async function _getShopCategories(locale: Locale = 'uk') {
  const name =
    locale === 'ru'
      ? sql<string>`COALESCE(NULLIF(${categories.nameRu}, ''), ${categories.nameUk})`
      : sql<string>`COALESCE(NULLIF(${categories.nameUk}, ''), ${categories.nameRu})`
  return db
    .select({
      id: categories.id,
      name,
      nameUk: categories.nameUk,
      nameRu: categories.nameRu,
      slug: categories.slug,
      parentId: categories.parentId,
      image: categories.image,
    })
    .from(categories)
    .where(eq(categories.isVisible, true))
    .orderBy(asc(categories.sortOrder), asc(name))
}

/**
 * Returns [categoryId, ...all descendant category ids] — the category tree
 * is flat (just parentId) so this walks it in app code (BFS) rather than a
 * recursive SQL CTE, which is plenty fast for a shop-sized category count.
 */
export function getCategoryAndDescendantIds(categoryId: number) {
  return unstable_cache(
    () => _getCategoryAndDescendantIds(categoryId),
    ['category-descendants', String(categoryId)],
    { tags: [CACHE_TAGS.categories], revalidate: 300 },
  )()
}

async function _getCategoryAndDescendantIds(categoryId: number): Promise<number[]> {
  const all = await db.select({ id: categories.id, parentId: categories.parentId }).from(categories)
  const childrenOf = new Map<number, number[]>()
  for (const row of all) {
    if (row.parentId == null) continue
    const list = childrenOf.get(row.parentId) ?? []
    list.push(row.id)
    childrenOf.set(row.parentId, list)
  }
  const result: number[] = [categoryId]
  const queue = [categoryId]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const child of childrenOf.get(current) ?? []) {
      result.push(child)
      queue.push(child)
    }
  }
  return result
}

export function getCategoryById(id: number, locale: Locale = 'uk') {
  return unstable_cache(
    async () => {
      const [row] = await db.select().from(categories).where(eq(categories.id, id)).limit(1)
      if (!row) return null
      const name =
        locale === 'ru'
          ? row.nameRu || row.nameUk
          : row.nameUk || row.nameRu
      const description =
        locale === 'ru'
          ? row.descriptionRu || row.descriptionUk
          : row.descriptionUk || row.descriptionRu
      return { ...row, name, description }
    },
    ['category', String(id), locale],
    { tags: [CACHE_TAGS.categories], revalidate: 300 },
  )()
}

/** Minimal product rows for building the sitemap (id + last modified). */
export async function getSitemapProducts() {
  return db
    .select({ id: products.id, updatedAt: products.updatedAt })
    .from(products)
    .where(baseWhere)
    .orderBy(desc(products.updatedAt))
    .limit(5000)
}

/** Minimal visible category rows for the sitemap. */
export async function getSitemapCategories() {
  return db
    .select({ id: categories.id, updatedAt: categories.updatedAt })
    .from(categories)
    .where(eq(categories.isVisible, true))
    .limit(1000)
}

/** Published article slugs for the sitemap. */
export async function getSitemapArticles() {
  return db
    .select({ slug: articles.slug, updatedAt: articles.updatedAt })
    .from(articles)
    .where(eq(articles.status, 'published'))
    .limit(1000)
}

/** Published static page slugs for the sitemap. */
export async function getSitemapPages() {
  return db
    .select({ slug: pages.slug, updatedAt: pages.updatedAt })
    .from(pages)
    .where(eq(pages.status, 'published'))
    .limit(200)
}

export function getActiveDeliveryMethods() {
  return unstable_cache(
    () =>
      db
        .select()
        .from(deliveryMethods)
        .where(eq(deliveryMethods.isActive, true))
        .orderBy(asc(deliveryMethods.sortOrder)),
    ['delivery-methods'],
    { tags: [CACHE_TAGS.checkout], revalidate: 300 },
  )()
}

export function getActivePaymentMethods() {
  return unstable_cache(
    () =>
      db
        .select()
        .from(paymentMethods)
        .where(eq(paymentMethods.isActive, true))
        .orderBy(asc(paymentMethods.sortOrder)),
    ['payment-methods'],
    { tags: [CACHE_TAGS.checkout], revalidate: 300 },
  )()
}

export function getActiveGateways() {
  return unstable_cache(
    () =>
      db
        .select()
        .from(paymentGateways)
        .where(eq(paymentGateways.isActive, true))
        .orderBy(asc(paymentGateways.sortOrder)),
    ['payment-gateways'],
    { tags: [CACHE_TAGS.checkout], revalidate: 300 },
  )()
}
