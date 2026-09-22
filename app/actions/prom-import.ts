'use server'

import { revalidatePath } from 'next/cache'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { db, pool } from '@/lib/db'
import {
  categories,
  importTasks,
  productCategory,
  productCharacteristics,
  productVariants,
  products,
} from '@/lib/db/schema'
import type { ProductOption, VariantOptions } from '@/lib/db/schema'
import { assertPermission, assertWritePermission } from '@/lib/session'
import { generateUniqueSlug } from '@/lib/product-slug'
import {
  fetchListingPage,
  fetchProduct,
  isAllowedPromUrl,
  slugify,
  withPage,
  type PromListItem,
  type PromVariationItem,
} from '@/lib/prom-import/scraper'
import { findAliasedCategory } from '@/lib/shop/category-aliases'
import {
  SIZE_OPTION_NAME_UK,
  extractSizeFromName,
  extractSizeFromUrlText,
  familyKeyFromParts,
  type SizeFamilyState,
} from '@/lib/prom-import/size-families'

// Safety cap: a Prom.ua shop can have thousands of listings. Importing that
// many product pages one at a time (2 fetches each, for uk+ru) would take
// far too long for one admin session and risks looking like abuse to
// Prom.ua, so a single import job only pulls the first N products it finds.
// Admins can re-run the import to pick up more if a shop grows past this.
const MAX_PRODUCTS_PER_JOB = 500
// Each button click / poll tick only scrapes this many products, so a single
// server action call always finishes in a few seconds regardless of shop size.
const BATCH_SIZE = 4

type PromImportState = {
  shopUrl: string
  origin: string
  pending: PromListItem[]
  capped: boolean
  /** Size-range siblings already imported as one product (name-based families). */
  sizeFamilies?: Record<string, SizeFamilyState>
}




/** Starts a new Prom.ua shop import: discovers every product link, then returns a task id to poll. */
export async function startPromImport(shopUrl: string) {
  await assertWritePermission('import')
  const trimmed = shopUrl.trim()
  if (!isAllowedPromUrl(trimmed)) {
    return { success: false as const, error: 'Ссылка должна вести на prom.ua (страницу магазина)' }
  }
  const first = await fetchListingPage(trimmed)
  if (!first || first.items.length === 0) {
    return { success: false as const, error: 'Не удалось загрузить товары по этой ссылке. Проверьте, что это страница магазина на Prom.ua' }
  }

  const origin = new URL(first.finalUrl).origin
  const seen = new Map<number, PromListItem>()
  for (const item of first.items) seen.set(item.id, item)

  const perPage = first.items.length
  const totalPages = perPage > 0 ? Math.ceil(Math.min(first.total, MAX_PRODUCTS_PER_JOB) / perPage) : 1
  for (let page = 2; page <= totalPages && seen.size < MAX_PRODUCTS_PER_JOB; page++) {
    // Stay polite to Prom.ua's servers — same spacing as the original
    // one-off scrape script (scripts/prom-scrape-v2.mjs).
    await new Promise((r) => setTimeout(r, 400))
    const next = await fetchListingPage(withPage(first.finalUrl, page))
    if (!next || next.items.length === 0) break
    for (const item of next.items) seen.set(item.id, item)
  }

  const capped = first.total > MAX_PRODUCTS_PER_JOB
  const pending = Array.from(seen.values()).slice(0, MAX_PRODUCTS_PER_JOB)

  const state: PromImportState = { shopUrl: trimmed, origin, pending, capped, sizeFamilies: {} }
  const [task] = await db
    .insert(importTasks)
    .values({
      fileName: trimmed,
      sourceType: 'prom',
      sourceUrl: trimmed,
      status: 'processing',
      totalItems: pending.length,
      startedAt: new Date(),
      state,
    })
    .returning({ id: importTasks.id })

  return {
    success: true as const,
    taskId: task.id,
    total: pending.length,
    capped,
    shopTotal: first.total,
  }
}

/** Finds or creates the category chain for a product's uk/ru breadcrumbs, returns the leaf id. */
async function ensureCategoryPath(
  breadcrumbsUk: { alias: string; caption: string }[],
  breadcrumbsRu: { alias: string; caption: string }[],
): Promise<number | null> {
  let parentId: number | null = null
  let leafId: number | null = null
  for (let i = 0; i < breadcrumbsUk.length; i++) {
    const nameUk = breadcrumbsUk[i].caption
    if (!nameUk) continue
    const nameRu = breadcrumbsRu[i]?.caption || nameUk

    // Match by name within the same parent (categories has no unique
    // constraint on name/slug, so we look it up manually to avoid creating
    // duplicate categories on every re-import). Also accept explicit aliases
    // so Prom "Техніка та електроніка" lands on the seeded "Електроніка" root.
    const siblings: { id: number; nameUk: string; nameRu: string | null }[] = await db
      .select({ id: categories.id, nameUk: categories.nameUk, nameRu: categories.nameRu })
      .from(categories)
      .where(parentId === null ? isNull(categories.parentId) : eq(categories.parentId, parentId))
    const aliased = findAliasedCategory(siblings, nameUk)

    if (aliased) {
      leafId = aliased.id
    } else {
      const slug = slugify(breadcrumbsUk[i].alias || nameUk) || `cat-${Date.now()}-${i}`
      const insertedRows: { id: number }[] = await db
        .insert(categories)
        .values({ nameUk, nameRu, slug, parentId, isVisible: true })
        .returning({ id: categories.id })
      leafId = insertedRows[0].id
    }
    parentId = leafId
  }
  return leafId
}

// Ukrainian/Russian attribute names that mean this choice axis is a color
// swatch rather than plain text (e.g. size), matching the admin editor's
// ProductOption.type so imported products get the same swatch UI.
const COLOR_AXIS_NAMES = ['колір', 'цвет', 'color']

// Common Ukrainian/Russian color-value names -> hex, so Prom.ua imports get
// real swatches instead of the generic grey placeholder the admin editor
// falls back to when a color option has no `swatches` entry. Prom.ua sends
// free-text color names (not hex), often with light-/dark- prefixes, so we
// match by substring against a base-color dictionary rather than exact value.
const COLOR_NAME_TO_HEX: [string, string][] = [
  ['чорн', '#1a1a1a'], ['черн', '#1a1a1a'], ['black', '#1a1a1a'],
  ['біл', '#f5f5f5'], ['бел', '#f5f5f5'], ['white', '#f5f5f5'],
  ['червон', '#c62828'], ['красн', '#c62828'], ['red', '#c62828'],
  ['бордов', '#7b1e2b'], ['вишнев', '#7b1e2b'],
  ['рожев', '#ec8fb0'], ['розов', '#ec8fb0'], ['pink', '#ec8fb0'],
  ['фіолетов', '#7e57c2'], ['фиолетов', '#7e57c2'], ['лавандов', '#b9a2e0'], ['purple', '#7e57c2'],
  ['син', '#2455a4'], ['blue', '#2455a4'],
  ['голуб', '#5fb3d9'],
  ['бірюзов', '#1fab8f'], ['бирюзов', '#1fab8f'], ['turquoise', '#1fab8f'],
  ['зелен', '#3c8a3c'], ['green', '#3c8a3c'],
  ['салатов', '#8bc34a'], ['лайм', '#8bc34a'],
  ['хакі', '#6b6d3a'], ['хаки', '#6b6d3a'], ['khaki', '#6b6d3a'],
  ['жовт', '#e8c93a'], ['желт', '#e8c93a'], ['yellow', '#e8c93a'],
  ['оранжев', '#ea7a2c'], ['orange', '#ea7a2c'],
  ['коричнев', '#6b4a30'], ['brown', '#6b4a30'],
  ['бежев', '#d8c5a3'], ['beige', '#d8c5a3'],
  ['сір', '#9a9a9a'], ['сер', '#9a9a9a'], ['gray', '#9a9a9a'], ['grey', '#9a9a9a'],
  ['срібн', '#c0c0c8'], ['серебр', '#c0c0c8'], ['silver', '#c0c0c8'],
  ['золот', '#c9a94a'], ['gold', '#c9a94a'],
]

/** Best-effort hex for a free-text Prom.ua color name; undefined if unrecognized. */
function guessColorHex(value: string): string | undefined {
  const v = value.toLowerCase()
  for (const [needle, hex] of COLOR_NAME_TO_HEX) {
    if (v.includes(needle)) return hex
  }
  return undefined
}

type BuiltVariant = { options: VariantOptions; isInStock: boolean; sortOrder: number }

const SIZE_AXIS_NAMES = ['розмір', 'размер', 'size']

function isJunkChoice(value: string): boolean {
  return !value.trim() || /маломір/i.test(value)
}

function splitAttrValues(value: string): string[] {
  return value
    .split(/[,;/|]+/)
    .map((v) => v.trim())
    .filter((v) => !isJunkChoice(v))
}

/** Size values for listing cards (`product.sizes` → «Обрати розмір»). */
function sizesFromOptions(options: ProductOption[]): string[] {
  const sizeOption = options.find((o) => SIZE_AXIS_NAMES.some((n) => o.name.toLowerCase().includes(n)))
  return (sizeOption?.values ?? []).filter((v) => !isJunkChoice(v))
}

function variantsFromSizeAttribute(
  fetchedInStock: boolean,
  fetchedAttributesUk: { group: string; name: string; value: string }[],
): { options: ProductOption[]; variants: BuiltVariant[]; anyInStock: boolean } | null {
  const sizeAttr = fetchedAttributesUk.find((a) => SIZE_AXIS_NAMES.some((n) => a.name.toLowerCase().includes(n)))
  const values = sizeAttr ? splitAttrValues(sizeAttr.value) : []
  if (!sizeAttr || values.length <= 1) return null
  const options: ProductOption[] = [{ name: sizeAttr.name, type: 'text', values }]
  const variants: BuiltVariant[] = values.map((value, i) => ({
    options: { [sizeAttr.name]: value },
    isInStock: fetchedInStock,
    sortOrder: i,
  }))
  return { options, variants, anyInStock: fetchedInStock }
}

/**
 * Turns a product's size/color siblings (from ProductVariationQuery, each a
 * separate Prom.ua product id with its own stock) into this store's
 * options/variants shape. Returns empty arrays when there's nothing to
 * choose (most products), so the storefront falls back to the plain
 * single-price/stock display instead of an empty selector.
 */
function buildVariants(
  fetchedPromId: number,
  fetchedInStock: boolean,
  fetchedAttributesUk: { group: string; name: string; value: string }[],
  siblings: PromVariationItem[],
): { options: ProductOption[]; variants: BuiltVariant[]; anyInStock: boolean } {
  if (siblings.length === 0) {
    return (
      variantsFromSizeAttribute(fetchedInStock, fetchedAttributesUk) ?? {
        options: [],
        variants: [],
        anyInStock: fetchedInStock,
      }
    )
  }

  // Siblings only carry the choice axis (e.g. size) that actually varies
  // between them (color etc. stays out since it's identical across sizes).
  const axisNames = Array.from(new Set(siblings.flatMap((v) => v.attributes.map((a) => a.name))))
  if (axisNames.length === 0) return { options: [], variants: [], anyInStock: fetchedInStock }

  // The scraped page is itself one choice in the group but doesn't repeat
  // its own axis value in `siblings` — it's on the page's own attribute
  // list instead (e.g. "Міжнародний розмір: XL" alongside "Колір: Зелений").
  const selfAttributes = axisNames
    .map((name) => {
      const found = fetchedAttributesUk.find(
        (a) => a.name === name || a.name.toLowerCase() === name.toLowerCase(),
      )
      const value = found ? splitAttrValues(found.value)[0] : undefined
      return found && value ? { name, value } : null
    })
    .filter((a): a is { name: string; value: string } => a !== null)
  const all = [
    { promId: fetchedPromId, inStock: fetchedInStock, attributes: selfAttributes },
    ...siblings.map((v) => ({
      ...v,
      attributes: v.attributes
        .map((a) => ({ ...a, value: splitAttrValues(a.value)[0] ?? a.value }))
        .filter((a) => !isJunkChoice(a.value)),
    })),
  ]

  const valuesByAxis = new Map<string, string[]>()
  for (const v of all) {
    for (const a of v.attributes) {
      if (isJunkChoice(a.value)) continue
      const list = valuesByAxis.get(a.name) ?? []
      if (!list.includes(a.value)) list.push(a.value)
      valuesByAxis.set(a.name, list)
    }
  }

  const options: ProductOption[] = axisNames.map((name) => {
    const isColor = COLOR_AXIS_NAMES.some((c) => name.toLowerCase().includes(c))
    const values = valuesByAxis.get(name) ?? []
    if (!isColor) return { name, type: 'text' as const, values }
    // Best-effort hex per value so the storefront shows real color swatches
    // instead of the generic grey placeholder used when none is set.
    const swatches: Record<string, string> = {}
    for (const value of values) {
      const hex = guessColorHex(value)
      if (hex) swatches[value] = hex
    }
    return { name, type: 'color' as const, values, swatches }
  })

  const variants: BuiltVariant[] = all
    .filter((v) => v.attributes.length > 0)
    .map((v, i) => ({
      options: Object.fromEntries(v.attributes.map((a) => [a.name, a.value])),
      isInStock: v.inStock,
      sortOrder: i,
    }))

  return { options, variants, anyInStock: all.some((v) => v.inStock) }
}


function sizeHintFromListing(nameUk: string, nameRu: string, urlText: string) {
  return extractSizeFromName(nameUk) || extractSizeFromName(nameRu) || extractSizeFromUrlText(urlText)
}

function stripSizeSuffix(name: string, size: string): string {
  const extracted = extractSizeFromName(name)
  if (extracted && extracted.size === size) return extracted.base
  return name
}

/**
 * Adds one size (from a standalone Prom listing) onto an already-imported
 * canonical product, then retires the duplicate row if this listing was
 * imported as its own product on an earlier run.
 */
async function mergeSizeIntoProduct(opts: {
  productId: number
  size: string
  inStock: boolean
  price: string
  oldPrice: string | null
  duplicateProductId?: number
}) {
  const [row] = await db
    .select({ options: products.options, sizes: products.sizes, isInStock: products.isInStock })
    .from(products)
    .where(eq(products.id, opts.productId))
    .limit(1)
  if (!row) return
  const options: ProductOption[] = Array.isArray(row.options) ? [...(row.options as ProductOption[])] : []
  let sizeOpt = options.find((o) => SIZE_AXIS_NAMES.some((n) => o.name.toLowerCase().includes(n)))
  if (!sizeOpt) {
    sizeOpt = { name: SIZE_OPTION_NAME_UK, type: 'text', values: [] }
    options.push(sizeOpt)
  }
  if (!sizeOpt.values.includes(opts.size)) sizeOpt.values = [...sizeOpt.values, opts.size]
  const existingVars = await db
    .select({ id: productVariants.id, options: productVariants.options })
    .from(productVariants)
    .where(eq(productVariants.productId, opts.productId))
  const already = existingVars.some((v) => {
    const o = (v.options ?? {}) as Record<string, string>
    return o[sizeOpt!.name] === opts.size
  })
  if (!already) {
    await db.insert(productVariants).values({
      productId: opts.productId,
      options: { [sizeOpt.name]: opts.size },
      price: opts.price,
      oldPrice: opts.oldPrice,
      quantity: opts.inStock ? 1 : 0,
      isInStock: opts.inStock,
      sortOrder: existingVars.length,
    })
  }
  const anyInStock = opts.inStock || Boolean(row.isInStock)
  await db
    .update(products)
    .set({
      options,
      sizes: sizesFromOptions(options),
      variantsEnabled: true,
      isInStock: anyInStock,
      quantity: anyInStock ? 1 : 0,
      stockStatus: anyInStock ? 'В наличии' : 'Нет в наличии',
    })
    .where(eq(products.id, opts.productId))
  if (opts.duplicateProductId && opts.duplicateProductId !== opts.productId) {
    await db
      .update(products)
      .set({ deletedAt: new Date() })
      .where(eq(products.id, opts.duplicateProductId))
  }
}

/** Processes the next small batch of a Prom.ua import job. Call repeatedly until `done: true`. */
export async function continuePromImport(taskId: number) {
  await assertWritePermission('import')

  // Atomic claim: two parallel polls used to read the same pending slice,
  // import the same products twice, then overwrite each other's state.
  // Lock the row, peel off this batch, write the remainder, then release —
  // FOR UPDATE only holds for the duration of this transaction.
  const client = await pool.connect()
  let batch: PromListItem[] = []
  let rest: PromListItem[] = []
  let state: PromImportState
  let processedBase = 0
  let successBase = 0
  let failedBase = 0
  let totalItems = 0
  try {
    await client.query('BEGIN')
    const claimed = await client.query<{
      processed_items: number | null
      success_items: number | null
      failed_items: number | null
      total_items: number | null
      state: PromImportState | null
    }>(
      `SELECT processed_items, success_items, failed_items, total_items, state
         FROM import_tasks
        WHERE id = $1
          AND source_type = 'prom'
          AND status = 'processing'
        FOR UPDATE SKIP LOCKED`,
      [taskId],
    )
    const row = claimed.rows[0]
    if (!row) {
      await client.query('ROLLBACK')
      const [existing] = await db.select().from(importTasks).where(eq(importTasks.id, taskId)).limit(1)
      if (!existing || existing.sourceType !== 'prom') {
        return { success: false as const, error: 'Задача импорта не найдена' }
      }
      if (existing.status !== 'processing') {
        return { success: true as const, done: true, processed: existing.processedItems ?? 0, total: existing.totalItems ?? 0 }
      }
      return { success: true as const, done: false, processed: existing.processedItems ?? 0, total: existing.totalItems ?? 0 }
    }
    if (!row.state || !Array.isArray(row.state.pending)) {
      await client.query('ROLLBACK')
      return { success: false as const, error: 'Повреждённое состояние задачи импорта' }
    }
    state = row.state
    batch = state.pending.slice(0, BATCH_SIZE)
    rest = state.pending.slice(BATCH_SIZE)
    processedBase = row.processed_items ?? 0
    successBase = row.success_items ?? 0
    failedBase = row.failed_items ?? 0
    totalItems = row.total_items ?? 0
    await client.query(
      `UPDATE import_tasks SET state = $2, updated_at = NOW() WHERE id = $1`,
      [taskId, { ...state, pending: rest }],
    )
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
  }
  let success = 0
  let failed = 0
  const errors: string[] = []

  for (const item of batch) {
    try {
      // Same politeness delay as the discovery loop / original scrape script.
      await new Promise((r) => setTimeout(r, 400))
      const p = await fetchProduct(state.origin, item)
      if (!p) throw new Error('не удалось загрузить страницу товара')

      // Some Prom.ua shops publish each size/color choice as its own
      // standalone product page instead of one page with a selector —
      // ProductVariationQuery still lists every sibling's promId in
      // `variationItems`, which is exactly the family buildVariants() below
      // turns into this product's options/variants. Without this check we
      // imported every sibling page as its own separate product (three
      // "identical shirt, different size" entries cluttering the catalog
      // and each other's "Похожие товары"). The lowest promId in the family
      // is always the base listing (no size suffix in its name) in every
      // case observed so far, so it's used as the one canonical product;
      // siblings are skipped entirely — the canonical page's own fetch
      // already captured their size/stock via variationItems.
      const family = [item.id, ...p.variationItems.map((v) => v.promId)]
      const canonicalId = Math.min(...family)
      if (family.length > 1 && canonicalId !== item.id) {
        success++
        continue
      }

      const leafCatId = p.breadcrumbsUk.length
        ? await ensureCategoryPath(p.breadcrumbsUk, p.breadcrumbsRu)
        : null

      const sku = p.sku?.trim() || null
      // Prom.ua listing pages don't always show a SKU, so matching on SKU
      // alone missed products that had none — every re-import silently
      // inserted a fresh duplicate for them instead of updating the
      // existing row. item.id (the numeric id in the Prom.ua product URL)
      // is always present, so it's tried first and is the reliable key;
      // SKU is kept as a fallback for rows imported before this field
      // existed.
      const existing: { id: number; slug: string | null }[] = await db
        .select({ id: products.id, slug: products.slug })
        .from(products)
        .where(and(eq(products.promId, item.id), isNull(products.deletedAt)))
        .limit(1)
      if (existing.length === 0 && sku) {
        const bySku = await db
          .select({ id: products.id, slug: products.slug })
          .from(products)
          .where(and(eq(products.sku, sku), isNull(products.deletedAt)))
          .limit(1)
        existing.push(...bySku)
      }

      // Standalone Prom listings that only differ by a size range in the
      // title ("Ролики 29-33" / "Ролики 34-37") are not linked via
      // ProductVariationQuery. Fold them into one product with a size axis
      // so the storefront shows «Обрати розмір» instead of two cards.
      const sizeFamilies = (state.sizeFamilies ??= {})
      const sizeHint = sizeHintFromListing(p.nameUk, p.nameRu, item.urlText)
      if (sizeHint && p.variationItems.length === 0) {
        const key = familyKeyFromParts(sizeHint.base)
        const family = sizeFamilies[key]
        if (family && family.productId) {
          await mergeSizeIntoProduct({
            productId: family.productId,
            size: sizeHint.size,
            inStock: p.inStock,
            price: String(p.price ?? 0),
            oldPrice: p.oldPrice != null ? String(p.oldPrice) : null,
            duplicateProductId: existing[0]?.id,
          })
          sizeFamilies[key] = {
            ...family,
            merged: true,
          }
          success++
          continue
        }
      }

      // Every product needs a working `/product/<slug>` URL — without one,
      // the storefront falls back to the numeric id (see getShopProducts in
      // lib/shop/queries.ts) and the product detail page's legacy-numeric-id
      // redirect immediately bounces back to that same numeric "slug",
      // looping forever instead of showing the page. Re-imports keep the
      // existing slug (so published links/SEO never change); only a
      // genuinely new product or a pre-existing row that never got one
      // generates a fresh slug here.
      const slug =
        existing.length > 0 && existing[0].slug
          ? existing[0].slug
          : await generateUniqueSlug(p.nameUk || p.nameRu || sku || `prom-${item.id}`, item.id, existing[0]?.id)

      // A product with a size/color choice is only "out of stock" if every
      // choice is — otherwise it showed as unavailable just because the one
      // size/color Prom.ua happened to serve us was sold out (see the
      // buildVariants comment).
      let { options, variants, anyInStock } = buildVariants(item.id, p.inStock, p.attributesUk, p.variationItems)
      if (sizeHint && p.variationItems.length === 0 && variants.length === 0) {
        options = [{ name: SIZE_OPTION_NAME_UK, type: 'text', values: [sizeHint.size] }]
        variants = [{ options: { [SIZE_OPTION_NAME_UK]: sizeHint.size }, isInStock: p.inStock, sortOrder: 0 }]
        anyInStock = p.inStock
        p.nameUk = stripSizeSuffix(p.nameUk, sizeHint.size)
        p.nameRu = stripSizeSuffix(p.nameRu, sizeHint.size)
      }
      const isInStock = anyInStock

      const values = {
        nameUk: p.nameUk || null,
        nameRu: p.nameRu || null,
        slug,
        descriptionUk: p.descriptionUk || null,
        descriptionRu: p.descriptionRu || null,
        // Prom.ua's own auto-generated SEO title/description for this
        // listing (scraped from the page's <head>, see extractHeadMeta in
        // lib/prom-import/scraper.ts) — previously left null for every
        // imported product, so imported listings had no SEO text at all.
        // metaTitleUk/Ru are varchar(255) — Prom's rendered <title> includes
        // price/seller/marketplace suffixes and can run past that.
        metaTitleUk: p.metaTitleUk ? p.metaTitleUk.slice(0, 255) : null,
        metaTitleRu: p.metaTitleRu ? p.metaTitleRu.slice(0, 255) : null,
        metaDescriptionUk: p.metaDescriptionUk || null,
        metaDescriptionRu: p.metaDescriptionRu || null,
        sku,
        promId: item.id,
        price: String(p.price ?? 0),
        oldPrice: p.oldPrice != null ? String(p.oldPrice) : null,
        currency: 'UAH',
        // Prom.ua doesn't expose exact stock counts, only in-stock/out-of-stock,
        // so 1 (not a made-up large number) is the honest quantity per variant.
        quantity: isInStock ? 1 : 0,
        stockStatus: isInStock ? 'В наличии' : 'Нет в наличии',
        isInStock,
        image: p.images[0] || null,
        images: p.images,
        options,
        sizes: sizesFromOptions(options),
        variantsEnabled: variants.length > 0,
      }

      let productId: number
      if (existing.length > 0) {
        await db.update(products).set(values).where(eq(products.id, existing[0].id))
        productId = existing[0].id
        // Re-imports refresh characteristics/variants from the source
        // rather than appending duplicates.
        await db.delete(productCharacteristics).where(eq(productCharacteristics.productId, productId))
        await db.delete(productVariants).where(eq(productVariants.productId, productId))
      } else {
        const insertedRows: { id: number }[] = await db.insert(products).values(values).returning({ id: products.id })
        productId = insertedRows[0].id
      }

      if (variants.length > 0) {
        await db.insert(productVariants).values(
          variants.map((v) => ({
            productId,
            options: v.options,
            price: values.price,
            oldPrice: values.oldPrice,
            quantity: v.isInStock ? 1 : 0,
            isInStock: v.isInStock,
            sortOrder: v.sortOrder,
          })),
        )
      }

      if (sizeHint && p.variationItems.length === 0) {
        const key = familyKeyFromParts(sizeHint.base)
        sizeFamilies[key] = {
          productId,
          promId: item.id,
          size: sizeHint.size,
          inStock: isInStock,
          merged: Boolean(sizeFamilies[key]?.merged),
        }
      }

      if (leafCatId) {
        const linked: { id: number }[] = await db
          .select({ id: productCategory.id })
          .from(productCategory)
          .where(and(eq(productCategory.productId, productId), eq(productCategory.categoryId, leafCatId)))
          .limit(1)
        if (linked.length === 0) {
          await db.insert(productCategory).values({ productId, categoryId: leafCatId })
        }
      }

      let order = 0
      for (const attr of p.attributesUk) {
        if (!attr.name || !attr.value) continue
        await db.insert(productCharacteristics).values({
          productId,
          name: attr.name,
          value: attr.value,
          sortOrder: order++,
        })
      }

      success++
    } catch (e) {
      failed++
      errors.push(`${item.urlText}: ${e instanceof Error ? e.message : 'ошибка'}`)
    }
  }

  // The claim transaction already removed this batch from `state.pending`.
  // Never write `{...state, pending: rest}` here: another worker may have
  // claimed the next batch while this one was scraping, and that stale
  // snapshot would put the other batch back into `pending`.
  //
  // Increment counters in SQL and merge size-family additions into the live
  // JSON state. The UPDATE is atomic, so parallel polls cannot lose counters
  // or resurrect already-claimed products.
  const newErrors = errors.length > 0 ? errors.join('\n') : null
  const updated = await pool.query<{
    status: 'processing' | 'completed'
    processed_items: number
    success_items: number
    failed_items: number
  }>(
    `UPDATE import_tasks
        SET processed_items = COALESCE(processed_items, 0) + $2,
            success_items = COALESCE(success_items, 0) + $3,
            failed_items = COALESCE(failed_items, 0) + $4,
            error_log = CASE
              WHEN $5::text IS NULL THEN error_log
              WHEN COALESCE(error_log, '') = '' THEN right($5::text, 10000)
              ELSE right(error_log || E'\\n' || $5::text, 10000)
            END,
            state = jsonb_set(
              COALESCE(state, '{}'::jsonb),
              '{sizeFamilies}',
              COALESCE(state->'sizeFamilies', '{}'::jsonb) || $6::jsonb,
              true
            ),
            status = CASE
              WHEN jsonb_array_length(COALESCE(state->'pending', '[]'::jsonb)) = 0
                THEN 'completed'
              ELSE 'processing'
            END,
            completed_at = CASE
              WHEN jsonb_array_length(COALESCE(state->'pending', '[]'::jsonb)) = 0
                THEN NOW()
              ELSE NULL
            END,
            updated_at = NOW()
      WHERE id = $1
      RETURNING status, processed_items, success_items, failed_items`,
    [taskId, batch.length, success, failed, newErrors, JSON.stringify(state.sizeFamilies ?? {})],
  )
  const result = updated.rows[0]
  const done = result?.status === 'completed'
  const processedItems = result?.processed_items ?? processedBase + batch.length
  const successItems = result?.success_items ?? successBase + success
  const failedItems = result?.failed_items ?? failedBase + failed

  if (done) {
    revalidatePath('/admin/products')
    revalidatePath('/admin/import')
    revalidatePath('/', 'layout')
  }

  return { success: true as const, done, processed: processedItems, total: totalItems, success_count: successItems, failed_count: failedItems }
}

/** Prom.ua import jobs left mid-way (e.g. tab closed) so the UI can offer a "Продолжить" button. */
export async function getUnfinishedPromImports() {
  await assertPermission('import')
  return db
    .select()
    .from(importTasks)
    .where(and(eq(importTasks.sourceType, 'prom'), eq(importTasks.status, 'processing')))
    .orderBy(desc(importTasks.createdAt))
    .limit(10)
}
