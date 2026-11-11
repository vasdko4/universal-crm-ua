'use server'

import { db, withDbClient, dbForClient } from '@/lib/db'
import {
  products,
  categories,
  productCategory,
  productGroupItems,
  productGroups,
  productCharacteristics,
  productVariants,
} from '@/lib/db/schema'
import type { ProductOption, VariantOptions } from '@/lib/db/schema'
import type { StockReason } from '@/lib/shop/stock-ledger'
import { and, asc, desc, eq, inArray, isNull, isNotNull, ne, or, sql, type SQL } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { assertPermission, assertWritePermission } from '@/lib/session'
import { revalidateStorefront } from '@/lib/shop/cache'
import { auditLog, fillAuditTemplate } from '@/lib/audit-log'
import { getAdminDictionary } from '@/lib/i18n/admin/dictionaries'
import { generateUniqueSlug, withSlugRetry } from '@/lib/product-slug'
import {
  ADMIN_MAX_LEN,
  INT32_MAX,
  MONEY_10_2_MAX,
  MONEY_10_3_MAX,
  adminStringTooLong,
  isAdminNumberInRange,
} from '@/lib/shop/checkout-validation'
import { normalizeBulkCharacteristics, planCharacteristicUpserts } from '@/lib/products/bulk-characteristics'
import { escapeLikeWildcards, ilikeEscaped, normPageParams, sanitizeSearch } from '@/lib/api/helpers'

export type VariantInput = {
  options: VariantOptions
  sku?: string | null
  price: string
  oldPrice?: string | null
  quantity: number
  image?: string | null
}

export type ProductFilters = {
  search?: string
  categoryId?: number
  status?: 'all' | 'visible' | 'hidden' | 'in_stock' | 'out_of_stock' | 'popular'
  sort?: 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'name'
  page?: number
  perPage?: number
}

export async function getProducts(filters: ProductFilters = {}) {
  await assertPermission('products')
  const { search, categoryId, status = 'all', sort = 'newest', page: rawPage = 1, perPage: rawPerPage = 10 } = filters
  const { page, pageSize: perPage } = normPageParams(rawPage, rawPerPage)

  const conditions: SQL[] = [isNull(products.deletedAt)]

  if (search?.trim()) {
    const q = `%${escapeLikeWildcards(sanitizeSearch(search.trim()))}%`
    const searchCond = or(
      ilikeEscaped(products.nameRu, q),
      ilikeEscaped(products.nameUk, q),
      ilikeEscaped(products.sku, q)
    )
    if (searchCond) conditions.push(searchCond)
  }

  if (status === 'visible') conditions.push(eq(products.isVisible, true))
  if (status === 'hidden') conditions.push(eq(products.isVisible, false))
  if (status === 'in_stock') conditions.push(sql`${products.quantity} > 0`)
  if (status === 'out_of_stock') conditions.push(eq(products.quantity, 0))
  if (status === 'popular') conditions.push(eq(products.isPopular, true))

  if (categoryId) {
    const rows = await db
      .select({ productId: productCategory.productId })
      .from(productCategory)
      .where(eq(productCategory.categoryId, categoryId))
    const ids = rows.map((r) => r.productId)
    if (ids.length === 0) return { items: [], total: 0, categoriesByProduct: {} }
    conditions.push(inArray(products.id, ids))
  }

  const where = and(...conditions)

  const orderBy =
    sort === 'oldest'
      ? asc(products.createdAt)
      : sort === 'price_asc'
        ? asc(products.price)
        : sort === 'price_desc'
          ? desc(products.price)
          : sort === 'name'
            ? asc(products.nameRu)
            : desc(products.createdAt)

  const [items, countRows] = await Promise.all([
    db
      .select()
      .from(products)
      .where(where)
      .orderBy(orderBy)
      .limit(perPage)
      .offset((page - 1) * perPage),
    db.select({ count: sql<number>`count(*)::int` }).from(products).where(where),
  ])

  const productIds = items.map((p) => p.id)
  const categoriesByProduct: Record<number, number[]> = {}
  if (productIds.length > 0) {
    const links = await db
      .select()
      .from(productCategory)
      .where(inArray(productCategory.productId, productIds))
    for (const link of links) {
      if (!categoriesByProduct[link.productId]) categoriesByProduct[link.productId] = []
      categoriesByProduct[link.productId].push(link.categoryId)
    }
  }

  return { items, total: countRows[0]?.count ?? 0, categoriesByProduct }
}

export async function getProduct(id: number) {
  await assertPermission('products')
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), isNull(products.deletedAt)))
  if (!product) return null

  const [categoryLinks, groupLinks, characteristics, variants] = await Promise.all([
    db.select().from(productCategory).where(eq(productCategory.productId, id)),
    db.select().from(productGroupItems).where(eq(productGroupItems.productId, id)),
    db
      .select()
      .from(productCharacteristics)
      .where(eq(productCharacteristics.productId, id))
      .orderBy(asc(productCharacteristics.sortOrder)),
    db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, id))
      .orderBy(asc(productVariants.sortOrder), asc(productVariants.id)),
  ])

  return {
    ...product,
    categoryIds: categoryLinks.map((l) => l.categoryId),
    groupIds: groupLinks.map((l) => l.groupId),
    characteristics,
    variants,
  }
}

export type ProductInput = {
  nameUk?: string | null
  nameRu?: string | null
  descriptionUk?: string | null
  descriptionRu?: string | null
  privateNotes?: string | null
  salesType?: string
  sku?: string | null
  barcode?: string | null
  price: string
  priceFrom?: boolean
  currency?: string
  oldPrice?: string | null
  costPrice?: string | null
  quantity: number
  unit?: string
  stockStatus?: string
  /**
   * Admin-set status shown only while quantity is 0: 'coming_soon' keeps the
   * product visible on the storefront but not purchasable; 'preorder' keeps
   * it visible and purchasable, and reports g:availability=preorder to
   * Google Merchant instead of dropping it from the feed. Ignored (forced
   * back to 'default') once the product actually has stock again.
   */
  availabilityMode?: 'default' | 'coming_soon' | 'preorder'
  siteGroupId?: number | null
  marketplaceCategoryId?: number | null
  width?: string | null
  height?: string | null
  length?: string | null
  weight?: string | null
  image?: string | null
  images?: string[]
  isVisible?: boolean
  isPopular?: boolean
  /** Admin-set addition to the displayed purchase count ("накрутка"). */
  purchasesBoost?: number
  metaTitleUk?: string | null
  metaTitleRu?: string | null
  metaDescriptionUk?: string | null
  metaDescriptionRu?: string | null
  /** Short title for the Google Merchant feed (trimmed, uk/ru). */
  feedTitleUk?: string | null
  feedTitleRu?: string | null
  categoryIds?: number[]
  groupIds?: number[]
  characteristics?: { name: string; value: string }[]
  options?: ProductOption[]
  variants?: VariantInput[]
  /** Whether variant-based pricing/stock (color, size, etc.) is turned on for this product. */
  variantsEnabled?: boolean
}

function validateProduct(input: ProductInput): string | null {
  if (!input.nameRu?.trim() && !input.nameUk?.trim()) {
    return 'Укажите название товара хотя бы на одном языке'
  }
  // String lengths mirror the varchar columns (lib/db/schema.ts) — without
  // this Postgres 500s on `value too long for type character varying(N)`.
  if (adminStringTooLong(input.nameUk, ADMIN_MAX_LEN.productName) || adminStringTooLong(input.nameRu, ADMIN_MAX_LEN.productName))
    return `Название товара не должно превышать ${ADMIN_MAX_LEN.productName} символов`
  if (adminStringTooLong(input.sku, ADMIN_MAX_LEN.sku))
    return `SKU не должен превышать ${ADMIN_MAX_LEN.sku} символов`
  if (adminStringTooLong(input.barcode, ADMIN_MAX_LEN.barcode))
    return `Штрихкод не должен превышать ${ADMIN_MAX_LEN.barcode} символов`
  if (adminStringTooLong(input.image, ADMIN_MAX_LEN.image))
    return `Ссылка на изображение не должна превышать ${ADMIN_MAX_LEN.image} символов`
  if (adminStringTooLong(input.metaTitleUk, ADMIN_MAX_LEN.metaTitle) || adminStringTooLong(input.metaTitleRu, ADMIN_MAX_LEN.metaTitle))
    return `Meta title не должен превышать ${ADMIN_MAX_LEN.metaTitle} символов`
  if (adminStringTooLong(input.feedTitleUk, ADMIN_MAX_LEN.feedTitle) || adminStringTooLong(input.feedTitleRu, ADMIN_MAX_LEN.feedTitle))
    return `Заголовок для фида не должен превышать ${ADMIN_MAX_LEN.feedTitle} символов`
  // Numbers: raw admin strings used to go straight into numeric columns
  // and 500 on `invalid input syntax` (NaN/Infinity) or `numeric field
  // overflow`. Finite + range-checked here, with a clear admin error.
  if (!isAdminNumberInRange(input.price, 0, MONEY_10_2_MAX))
    return 'Цена должна быть числом от 0 до 100 000 000'
  if (!Number.isInteger(input.quantity) || input.quantity < 0 || input.quantity > INT32_MAX)
    return 'Количество должно быть целым числом от 0 до 2147483647'
  if (input.oldPrice != null && input.oldPrice !== '' && !isAdminNumberInRange(input.oldPrice, 0, MONEY_10_2_MAX))
    return 'Старая цена должна быть числом от 0 до 100 000 000'
  if (input.costPrice != null && input.costPrice !== '' && !isAdminNumberInRange(input.costPrice, 0, MONEY_10_2_MAX))
    return 'Себестоимость должна быть числом от 0 до 100 000 000'
  for (const [label, v] of [
    ['Ширина', input.width],
    ['Высота', input.height],
    ['Длина', input.length],
  ] as const) {
    if (v != null && v !== '' && !isAdminNumberInRange(v, 0, MONEY_10_2_MAX))
      return `${label} должна быть числом от 0 до 100 000 000`
  }
  if (input.weight != null && input.weight !== '' && !isAdminNumberInRange(input.weight, 0, MONEY_10_3_MAX))
    return 'Вес должен быть числом от 0 до 10 000 000'
  if (
    input.purchasesBoost != null &&
    (!Number.isInteger(input.purchasesBoost) || input.purchasesBoost < 0 || input.purchasesBoost > INT32_MAX)
  )
    return 'Накрутка счётчика должна быть целым числом от 0 до 2147483647'
  for (const c of input.characteristics || []) {
    if (adminStringTooLong(c.name, ADMIN_MAX_LEN.charName))
      return `Название характеристики «${c.name.trim().slice(0, 40)}» превышает ${ADMIN_MAX_LEN.charName} символов`
  }
  const variants = input.variants || []
  for (let i = 0; i < variants.length; i++) {
    const v = variants[i]
    if (v.price !== '' && !isAdminNumberInRange(v.price, 0, MONEY_10_2_MAX))
      return `Цена варианта #${i + 1} должна быть числом от 0 до 100 000 000`
    if (v.oldPrice != null && v.oldPrice !== '' && !isAdminNumberInRange(v.oldPrice, 0, MONEY_10_2_MAX))
      return `Старая цена варианта #${i + 1} должна быть числом от 0 до 100 000 000`
    if (!Number.isInteger(v.quantity) || v.quantity < 0 || v.quantity > INT32_MAX)
      return `Количество варианта #${i + 1} должно быть целым числом от 0 до 2147483647`
    if (adminStringTooLong(v.sku, ADMIN_MAX_LEN.sku))
      return `SKU варианта #${i + 1} не должен превышать ${ADMIN_MAX_LEN.sku} символов`
  }
  return null
}

/** Thrown by syncRelations when a referenced category/group id does not exist. Callers catch it and return a form error — never a 500. */
class UnknownRelationError extends Error {}

// Clean/validate the option axes, dropping empty names and values.
function cleanOptions(options: ProductOption[] | undefined): ProductOption[] {
  if (!options) return []
  return options
    .map((o) => ({
      name: (o.name ?? '').trim(),
      type: o.type === 'color' ? ('color' as const) : ('text' as const),
      values: (o.values ?? []).map((v) => v.trim()).filter(Boolean),
      swatches:
        o.swatches && Object.keys(o.swatches).length > 0 ? o.swatches : undefined,
    }))
    .filter((o) => o.name && o.values.length > 0)
}

// Keep only variants whose options match the defined axes and have a valid
// non-negative price. BUGFIX: negative prices used to pass the filter and
// Math.min() made the whole product price negative on the storefront.
function cleanVariants(input: ProductInput): VariantInput[] {
  const options = cleanOptions(input.options)
  if (options.length === 0 || !input.variants) return []
  const axisNames = options.map((o) => o.name)
  return input.variants
    .map((v) => {
      const opts: VariantOptions = {}
      for (const name of axisNames) {
        if (v.options?.[name]) opts[name] = v.options[name]
      }
      return { ...v, options: opts }
    })
    .filter((v) => {
      if (Object.keys(v.options).length !== axisNames.length || v.price === '') return false
      const n = Number(v.price)
      return Number.isFinite(n) && n >= 0
    })
}

function toProductRow(input: ProductInput) {
  const num = (v: string | null | undefined) => (v == null || v === '' ? null : v)
  const options = cleanOptions(input.options)
  const variants = cleanVariants(input)
  const variantsEnabled = input.variantsEnabled ?? false
  // The variant matrix only drives price/stock when the admin has explicitly
  // turned it on for this product — otherwise it's ignored even if variant
  // rows exist (e.g. temporarily disabled without losing the data).
  const hasVariants = variantsEnabled && variants.length > 0
  // When variants exist, the product-level price/stock become aggregates so
  // that catalog cards, filters and availability badges stay correct.
  const aggPrice = hasVariants
    ? Math.min(...variants.map((v) => Number(v.price))).toString()
    : input.price
  const aggQty = hasVariants
    ? variants.reduce((s, v) => s + Math.max(0, Math.trunc(v.quantity || 0)), 0)
    : input.quantity
  return {
    nameUk: input.nameUk?.trim() || null,
    nameRu: input.nameRu?.trim() || null,
    descriptionUk: input.descriptionUk || null,
    descriptionRu: input.descriptionRu || null,
    privateNotes: input.privateNotes || null,
    salesType: input.salesType || 'retail',
    sku: input.sku?.trim() || null,
    barcode: input.barcode?.trim() || null,
    price: aggPrice,
    // "От" pricing makes sense automatically when a product has variants.
    priceFrom: hasVariants ? true : (input.priceFrom ?? false),
    currency: input.currency || 'UAH',
    oldPrice: num(input.oldPrice),
    costPrice: num(input.costPrice),
    quantity: aggQty,
    unit: input.unit || 'шт',
    options,
    variantsEnabled,
    stockStatus: aggQty > 0 ? input.stockStatus || 'В наявності' : 'Немає в наявності',
    siteGroupId: input.siteGroupId ?? null,
    marketplaceCategoryId: input.marketplaceCategoryId ?? null,
    width: num(input.width),
    height: num(input.height),
    length: num(input.length),
    weight: num(input.weight),
    image: input.image || null,
    images: (input.images || []).filter(Boolean),
    isVisible: input.isVisible ?? true,
    isInStock: aggQty > 0,
    // Only meaningful while genuinely out of stock — a product that has
    // stock is just "in stock", regardless of whatever was selected here.
    availabilityMode:
      aggQty > 0
        ? 'default'
        : input.availabilityMode === 'coming_soon' || input.availabilityMode === 'preorder'
          ? input.availabilityMode
          : 'default',
    isPopular: input.isPopular ?? false,
    purchasesBoost: Math.max(0, Math.trunc(input.purchasesBoost ?? 0)),
    metaTitleUk: input.metaTitleUk || null,
    metaTitleRu: input.metaTitleRu || null,
    metaDescriptionUk: input.metaDescriptionUk || null,
    metaDescriptionRu: input.metaDescriptionRu || null,
    feedTitleUk: input.feedTitleUk || null,
    feedTitleRu: input.feedTitleRu || null,
    updatedAt: new Date(),
  }
}

async function syncRelations(
  productId: number,
  input: ProductInput,
  tx: Pick<typeof db, 'delete' | 'insert' | 'select' | 'update'> = db,
) {
  // Validate referenced ids BEFORE any destructive write: a stale category
  // or group id used to wipe the product's links first and then fail the
  // insert, silently unlisting the product. FOR SHARE locks the referenced
  // rows so they cannot be deleted by a concurrent admin mid-save.
  // Unknown ids throw UnknownRelationError — the caller turns it into a
  // form error naming the ids (never a 500), and the transaction rolls back.
  const categoryIds = [...new Set((input.categoryIds || []).filter((n) => Number.isInteger(n) && n > 0))]
  const groupIds = [...new Set((input.groupIds || []).filter((n) => Number.isInteger(n) && n > 0))]
  if (categoryIds.length > 0) {
    const rows = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(inArray(categories.id, categoryIds))
      .for('share')
    const missing = categoryIds.filter((id) => !rows.some((r) => r.id === id))
    if (missing.length > 0) throw new UnknownRelationError(`Категорії не знайдено: ${missing.join(', ')}`)
  }
  if (groupIds.length > 0) {
    const rows = await tx
      .select({ id: productGroups.id })
      .from(productGroups)
      .where(inArray(productGroups.id, groupIds))
      .for('share')
    const missing = groupIds.filter((id) => !rows.some((r) => r.id === id))
    if (missing.length > 0) throw new UnknownRelationError(`Групи не знайдено: ${missing.join(', ')}`)
  }

  await tx.delete(productCategory).where(eq(productCategory.productId, productId))
  if (categoryIds.length > 0) {
    await tx
      .insert(productCategory)
      .values(categoryIds.map((categoryId) => ({ productId, categoryId })))
  }

  await tx.delete(productGroupItems).where(eq(productGroupItems.productId, productId))
  if (groupIds.length > 0) {
    await tx
      .insert(productGroupItems)
      .values(groupIds.map((groupId, i) => ({ productId, groupId, sortOrder: i })))
  }

  await tx.delete(productCharacteristics).where(eq(productCharacteristics.productId, productId))
  const chars = (input.characteristics || []).filter((c) => c.name.trim() && c.value.trim())
  if (chars.length > 0) {
    await tx.insert(productCharacteristics).values(
      chars.map((c, i) => ({
        productId,
        name: c.name.trim(),
        value: c.value.trim(),
        sortOrder: i,
      }))
    )
  }

  // Variants keep stable IDs across saves: match incoming rows to existing
  // ones by options first, then by SKU, and update in place. Only rows with
  // no match are inserted, and only existing rows with no incoming match are
  // deleted. The old delete-all + re-insert gave every variant a new ID on
  // every save, breaking any link that referenced a variant (cart lines,
  // order items, external refs).
  const variants = cleanVariants(input)
  const existing = await tx
    .select({ id: productVariants.id, options: productVariants.options, sku: productVariants.sku })
    .from(productVariants)
    .where(eq(productVariants.productId, productId))
  const variantKey = (options: VariantOptions): string =>
    JSON.stringify(Object.keys(options).sort().map((k) => [k, options[k]]))
  const byOptions = new Map(existing.map((v) => [variantKey(v.options as VariantOptions), v]))
  const bySku = new Map(
    existing.filter((v) => v.sku?.trim()).map((v) => [v.sku!.trim(), v]),
  )
  const matchedIds = new Set<number>()
  for (let i = 0; i < variants.length; i++) {
    const v = variants[i]
    const qty = Math.max(0, Math.trunc(v.quantity || 0))
    const old = v.oldPrice == null || v.oldPrice === '' ? null : v.oldPrice
    const row = {
      productId,
      options: v.options,
      sku: v.sku?.trim() || null,
      price: v.price,
      oldPrice: old,
      quantity: qty,
      image: v.image || null,
      isInStock: qty > 0,
      sortOrder: i,
    }
    const target = byOptions.get(variantKey(v.options)) ?? (v.sku?.trim() ? bySku.get(v.sku.trim()) : undefined)
    if (target && !matchedIds.has(target.id)) {
      matchedIds.add(target.id)
      await tx.update(productVariants).set(row).where(eq(productVariants.id, target.id))
    } else {
      await tx.insert(productVariants).values(row)
    }
  }
  const stale = existing.filter((v) => !matchedIds.has(v.id))
  if (stale.length > 0) {
    await tx.delete(productVariants).where(inArray(productVariants.id, stale.map((v) => v.id)))
  }
}

export async function createProduct(input: ProductInput) {
  const user = await assertWritePermission('products')
  const error = validateProduct(input)
  if (error) return { success: false, error }

  const name = input.nameUk || input.nameRu || ''
  // Best-effort uniqueness check on the pool; the unique index is the final
  // arbiter and withSlugRetry bumps the suffix on 23505 (each attempt runs
  // in a fresh transaction — a failed INSERT aborts its transaction, so the
  // retry can never reuse it). The slug is set by the INSERT itself, so a
  // product is never left with slug = NULL for a later UPDATE to fill.
  const firstSlug = await generateUniqueSlug(name, Date.now())
  let created: { id: number; slug: string }
  try {
    const res = await withSlugRetry(firstSlug, async (slug) => {
      return withDbClient(async (client) => {
        const tx = dbForClient(client)
        const [row] = await tx
          .insert(products)
          .values({ ...toProductRow(input), slug })
          .returning({ id: products.id })
        await syncRelations(row.id, input, tx)
        return { id: row.id, slug }
      })
    })
    created = res.result
  } catch (e) {
    if (e instanceof UnknownRelationError) return { success: false, error: e.message }
    throw e
  }

  void auditLog({
    userId: user.id, userName: user.name, userEmail: user.email,
    action: 'create', entity: 'product', entityId: created.id,
    details: fillAuditTemplate(getAdminDictionary(user.locale).auditLog.productCreated, {
      name: input.nameUk || input.nameRu || '',
    }),
  })

  revalidatePath('/admin/products')
  revalidateStorefront()
  return { success: true, id: created.id }
}

export async function updateProduct(id: number, input: ProductInput) {
  const user = await assertWritePermission('products')
  const error = validateProduct(input)
  if (error) return { success: false, error }

  const name = input.nameUk || input.nameRu || ''
  const firstSlug = await generateUniqueSlug(name, id, id)
  let updated: { slug: string } | null
  try {
    const res = await withSlugRetry(firstSlug, async (candidate) => {
      return withDbClient(async (client) => {
        const tx = dbForClient(client)
        // Row lock: a second writer waits for the first transaction to
        // commit and then re-reads fresh state instead of overwriting
        // stale state. The row update, the relations sync and the slug
        // self-heal run in the same transaction, so they can never be
        // torn apart by a concurrent save.
        const [existing] = await tx
          .select({ id: products.id, slug: products.slug })
          .from(products)
          .where(eq(products.id, id))
          .for('update')
        if (!existing) return null
        await tx.update(products).set(toProductRow(input)).where(eq(products.id, id))
        await syncRelations(id, input, tx)
        // Slugs are set once and kept stable across renames (protects links/SEO
        // already shared or indexed) — only self-heal products that predate this
        // column and never got one. The candidate is the pool-checked slug;
        // on a 23505 race the retry uses the bumped suffix.
        let slug = existing.slug
        if (!slug) {
          slug = candidate
          await tx.update(products).set({ slug }).where(eq(products.id, id))
        }
        return { slug }
      })
    })
    updated = res.result
  } catch (e) {
    if (e instanceof UnknownRelationError) return { success: false, error: e.message }
    throw e
  }
  if (!updated) return { success: false, error: 'Товар не найден' }

  void auditLog({
    userId: user.id, userName: user.name, userEmail: user.email,
    action: 'update', entity: 'product', entityId: id,
    details: fillAuditTemplate(getAdminDictionary(user.locale).auditLog.productUpdated, {
      name: input.nameUk || input.nameRu || '',
    }),
  })

  revalidatePath('/admin/products')
  revalidatePath(`/admin/products/${id}/edit`)
  revalidatePath(`/product/${updated.slug}`)
  revalidateStorefront(id)
  return { success: true, id }
}

export async function softDeleteProducts(ids: number[]) {
  const user = await assertWritePermission('products')
  if (ids.length === 0) return { success: false, error: 'Ничего не выбрано' }
  await db.update(products).set({ deletedAt: new Date() }).where(inArray(products.id, ids))

  void auditLog({
    userId: user.id, userName: user.name, userEmail: user.email,
    action: 'delete', entity: 'product',
    details: fillAuditTemplate(getAdminDictionary(user.locale).auditLog.productsTrashed, {
      ids: ids.join(', '),
    }),
  })

  revalidatePath('/admin/products')
  revalidatePath('/admin/trash')
  revalidateStorefront()
  return { success: true }
}

export async function setProductsVisibility(ids: number[], isVisible: boolean) {
  await assertWritePermission('products')
  if (ids.length === 0) return { success: false, error: 'Ничего не выбрано' }
  await db
    .update(products)
    .set({ isVisible, updatedAt: new Date() })
    .where(inArray(products.id, ids))
  revalidatePath('/admin/products')
  revalidateStorefront()
  return { success: true }
}

/**
 * Bulk brand + characteristics: upsert the given name→value pairs for every
 * selected product. Same-name characteristics (case-insensitive) are updated,
 * missing ones are appended; everything else is left untouched. Empty values
 * never erase data. One audit-log entry per operation.
 */
export async function bulkSetProductCharacteristics(
  ids: number[],
  brand: string,
  chars: { name: string; value: string }[],
) {
  const user = await assertWritePermission('products')
  const t = getAdminDictionary(user.locale).products
  const unique = uniqueIds(ids)
  if (!unique.length) return { success: false, error: t.errNothingSelected }
  const updates = normalizeBulkCharacteristics(brand ?? '', chars ?? [])
  if (!updates.length) return { success: false, error: t.errCharsEmpty }
  await withDbClient(async (client) => {
    const tx = dbForClient(client)
    for (const productId of unique) {
      const existing = await tx
        .select({
          id: productCharacteristics.id,
          name: productCharacteristics.name,
          value: productCharacteristics.value,
          sortOrder: productCharacteristics.sortOrder,
        })
        .from(productCharacteristics)
        .where(eq(productCharacteristics.productId, productId))
      const { toUpdate, toInsert } = planCharacteristicUpserts(existing, updates)
      for (const u of toUpdate) {
        await tx
          .update(productCharacteristics)
          .set({ value: u.value, updatedAt: new Date() })
          .where(eq(productCharacteristics.id, u.id))
      }
      if (toInsert.length > 0) {
        const maxSort = existing.reduce((m, r) => Math.max(m, r.sortOrder ?? 0), -1)
        await tx.insert(productCharacteristics).values(
          toInsert.map((c, i) => ({
            productId,
            name: c.name,
            value: c.value,
            sortOrder: maxSort + 1 + i,
          })),
        )
      }
    }
    await tx
      .update(products)
      .set({ updatedAt: new Date() })
      .where(inArray(products.id, unique))
  })
  const names = updates.map((u) => u.name).join(', ')
  void auditLog({
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    action: 'update',
    entity: 'product',
    details: `Масові характеристики для ${unique.length} товарів: ${names}`,
  })
  revalidatePath('/admin/products')
  revalidateStorefront()
  return { success: true }
}

export async function duplicateProduct(id: number) {
  await assertWritePermission('products')
  const source = await getProduct(id)
  if (!source) return { success: false, error: 'Товар не найден' }

  const { id: _id, createdAt, updatedAt, deletedAt, categoryIds, groupIds, characteristics, viewsCount, ordersCount,
    // BUGFIX: slug is UNIQUE — copying it verbatim made every duplication of a
    // product with a slug crash with a unique-violation (unhandled 500).
    // promId must not be copied either: the Prom.ua importer matches on it,
    // and a duplicate promId would make the next import overwrite the copy
    // (or pick nondeterministically between the two rows).
    slug: _slug, promId: _promId, variants: sourceVariants, ...rest } = source

  // The copy gets a fresh unique slug, set by the INSERT itself — the old
  // code inserted slug = NULL and healed it with a pool-checked
  // generateUniqueSlug + UPDATE, which raced (23505 → 500) under
  // concurrent duplications. Same retry as createProduct.
  const firstSlug = await generateUniqueSlug(
    rest.nameUk || rest.nameRu || `product-${Date.now()}`,
    Date.now(),
  )
  let created: { id: number }
  try {
    const res = await withSlugRetry(firstSlug, async (slug) => {
      return withDbClient(async (client) => {
        const tx = dbForClient(client)
        const [row] = await tx
          .insert(products)
          .values({
            ...rest,
            slug,
            promId: null,
            nameRu: rest.nameRu ? `${rest.nameRu} (копия)` : null,
            nameUk: rest.nameUk ? `${rest.nameUk} (копія)` : null,
            sku: rest.sku ? `${rest.sku}-COPY` : null,
          })
          .returning({ id: products.id })
        // BUGFIX: syncRelations was called without options/variants, so the
        // variant matrix was wiped and the copy kept variantsEnabled=true with
        // zero variants. Copy the source matrix over (new SKUs to avoid clashes).
        await syncRelations(row.id, {
          price: rest.price,
          quantity: rest.quantity,
          categoryIds,
          groupIds,
          characteristics: characteristics.map((c) => ({ name: c.name, value: c.value })),
          options: (rest.options as ProductInput['options']) ?? [],
          variantsEnabled: rest.variantsEnabled,
          variants: (sourceVariants ?? []).map((v) => ({
            options: (v.options ?? {}) as VariantOptions,
            sku: v.sku ? `${v.sku}-COPY` : null,
            price: String(v.price ?? 0),
            oldPrice: v.oldPrice != null ? String(v.oldPrice) : null,
            quantity: v.quantity ?? 0,
            image: v.image,
          })),
        }, tx)
        return row
      })
    })
    created = res.result
  } catch (e) {
    if (e instanceof UnknownRelationError) return { success: false, error: e.message }
    throw e
  }

  revalidatePath('/admin/products')
  revalidateStorefront()
  return { success: true, id: created.id }
}

// ---------- Trash ----------

// SECURITY: was missing the same 'trash' permission check that guards
// restoreProducts/permanentlyDeleteProducts/emptyTrash below. As a server
// action it's reachable directly regardless of the admin page-level route
// guard, so any logged-in admin-center user — regardless of role — could
// read every soft-deleted product (cost price, SKU, etc.) without the trash
// permission.
export async function getTrashedProducts() {
  await assertPermission('trash')
  return db
    .select()
    .from(products)
    .where(isNotNull(products.deletedAt))
    .orderBy(desc(products.deletedAt))
}

export async function restoreProducts(ids: number[]) {
  await assertWritePermission('trash')
  if (ids.length === 0) return { success: false, error: 'Ничего не выбрано' }
  await db.update(products).set({ deletedAt: null }).where(inArray(products.id, ids))
  revalidatePath('/admin/products')
  revalidatePath('/admin/trash')
  revalidateStorefront()
  return { success: true }
}

export async function permanentlyDeleteProducts(ids: number[]) {
  await assertWritePermission('trash')
  if (ids.length === 0) return { success: false, error: 'Ничего не выбрано' }
  await withDbClient(async (client) => {
    const tx = dbForClient(client)
    await tx.delete(productCategory).where(inArray(productCategory.productId, ids))
    await tx.delete(productGroupItems).where(inArray(productGroupItems.productId, ids))
    await tx.delete(productCharacteristics).where(inArray(productCharacteristics.productId, ids))
    await tx.delete(products).where(and(inArray(products.id, ids), isNotNull(products.deletedAt)))
  })
  revalidatePath('/admin/trash')
  revalidateStorefront()
  return { success: true }
}

// Business alert: visible products that are running out of stock. Shown on the
// admin dashboard so the owner can reorder before sales stop.
export async function getLowStockProducts(threshold = 3, limit = 6) {
  await assertPermission('dashboard')
  return db
    .select({
      id: products.id,
      nameRu: products.nameRu,
      nameUk: products.nameUk,
      sku: products.sku,
      image: products.image,
      quantity: products.quantity,
    })
    .from(products)
    .where(
      and(
        isNull(products.deletedAt),
        eq(products.isVisible, true),
        sql`${products.quantity} <= ${threshold}`,
      ),
    )
    .orderBy(asc(products.quantity))
    .limit(limit)
}

export async function emptyTrash() {
  await assertWritePermission('trash')
  const trashed = await db
    .select({ id: products.id })
    .from(products)
    .where(isNotNull(products.deletedAt))
  const ids = trashed.map((t) => t.id)
  if (ids.length === 0) return { success: true }
  return permanentlyDeleteProducts(ids)
}

function uniqueIds(ids: number[]) {
  return [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))].slice(0, 200)
}

// BUGFIX: products with variants_enabled derive price/quantity from the
// variant matrix (MIN/SUM) — writing the aggregates directly desyncs them.
// Bulk ops skip those products and report how many were skipped.
async function splitVariantProducts(ids: number[]): Promise<{ plain: number[]; skipped: number }> {
  if (ids.length === 0) return { plain: [], skipped: 0 }
  const rows = await db
    .select({ id: products.id })
    .from(products)
    .where(and(inArray(products.id, ids), eq(products.variantsEnabled, true)))
  const variantIds = new Set(rows.map((r) => r.id))
  return { plain: ids.filter((id) => !variantIds.has(id)), skipped: variantIds.size }
}

/** Inline price edit from the products table (single product, no variant matrix). */
export async function updateProductPrice(id: number, price: number) {
  const user = await assertWritePermission('products')
  const t = getAdminDictionary(user.locale).products
  if (!Number.isInteger(id) || id <= 0) return { success: false, error: t.errInvalidProduct }
  if (!Number.isFinite(price) || price < 0 || price >= MONEY_10_2_MAX) return { success: false, error: t.errInvalidPrice }
  const { skipped } = await splitVariantProducts([id])
  if (skipped) return { success: false, error: t.errVariantMatrixPrice }
  await db
    .update(products)
    .set({ price: price.toFixed(2), updatedAt: new Date() })
    .where(eq(products.id, id))
  void auditLog({
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    action: 'update',
    entity: 'product',
    details: `Ціна ${price.toFixed(2)} для товару #${id} (швидке редагування)`,
  })
  revalidatePath('/admin/products')
  revalidateStorefront()
  return { success: true }
}

/** Inline stock edit from the products table (single product, absolute value). */
export async function updateProductStock(id: number, quantity: number) {
  const user = await assertWritePermission('products')
  const t = getAdminDictionary(user.locale).products
  if (!Number.isInteger(id) || id <= 0) return { success: false, error: t.errInvalidProduct }
  const qty = Math.trunc(quantity)
  if (!Number.isFinite(qty) || qty < 0 || qty > INT32_MAX) return { success: false, error: t.errInvalidStock }
  const { skipped } = await splitVariantProducts([id])
  if (skipped) return { success: false, error: t.errVariantMatrixStock }
  const { recordStockMovement } = await import('@/lib/shop/stock-ledger')
  // Lock-then-update in TWO statements: SELECT ... FOR UPDATE first, so
  // qty_before is the true "before" even when a concurrent transaction
  // commits between our read and our update. The old single-statement CTE
  // read qty_before from the statement-start snapshot while EvalPlanQual
  // applied the UPDATE on the newest row version, so the ledger delta could
  // exceed the actual change (two +5 adjusts from 10 wrote deltas +5 and
  // +10, summing to +15 for a +10 stock move). A SELECT ... FOR UPDATE that
  // blocks returns the newest committed version after the locker commits.
  // (Do NOT move the FOR UPDATE into the CTE: CTE evaluation order is
  // unpredictable and the CTE would still see the pre-statement snapshot.)
  const changed = await withDbClient(async (client) => {
    const locked = await client.query<{ id: number; quantity: number }>(
      'SELECT id, quantity FROM products WHERE id = $1 FOR UPDATE',
      [id],
    )
    if (locked.rows.length === 0) return null
    const qtyBefore = Number(locked.rows[0].quantity)
    const res = await client.query<{ id: number; qty_after: number }>(
      `UPDATE products p SET
         quantity = $2,
         is_in_stock = $2 > 0,
         stock_status = CASE
           WHEN $2 = 0 THEN 'Немає в наявності'
           WHEN p.stock_status = 'Немає в наявності' THEN 'В наявності'
           ELSE p.stock_status
         END,
         updated_at = NOW()
       WHERE p.id = $1
       RETURNING p.id, p.quantity AS qty_after`,
      [id, qty],
    )
    if (res.rows.length === 0) return null
    const row = res.rows[0]
    const actualDelta = Number(row.qty_after) - qtyBefore
    if (actualDelta !== 0) {
      await recordStockMovement(
        {
          productId: Number(row.id),
          delta: actualDelta,
          quantityAfter: Number(row.qty_after),
          reason: 'adjust',
          actor: user.name,
        },
        client,
      )
    }
    return true
  })
  if (!changed) return { success: false, error: t.errProductNotFound }
  revalidatePath('/admin/products')
  revalidateStorefront()
  return { success: true }
}

export async function bulkSetProductPrice(ids: number[], price: number) {
  const user = await assertWritePermission('products')
  const t = getAdminDictionary(user.locale).products
  const unique = uniqueIds(ids)
  if (!unique.length) return { success: false, error: t.errNothingSelected }
  if (!Number.isFinite(price) || price < 0 || price >= MONEY_10_2_MAX) return { success: false, error: t.errInvalidPrice }
  const { plain, skipped } = await splitVariantProducts(unique)
  if (plain.length > 0) {
    await db
      .update(products)
      .set({ price: price.toFixed(2), updatedAt: new Date() })
      .where(inArray(products.id, plain))
  }
  void auditLog({
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    action: 'update',
    entity: 'product',
    details: `Масова ціна ${price.toFixed(2)} для ${plain.length} товарів${skipped ? ` (пропущено ${skipped} з варіантами)` : ''}`,
  })
  revalidatePath('/admin/products')
  revalidateStorefront()
  return { success: true, skipped }
}

export async function bulkAdjustProductStock(ids: number[], delta: number, reason: StockReason = 'bulk') {
  const user = await assertWritePermission('products')
  const t = getAdminDictionary(user.locale).products
  const unique = uniqueIds(ids)
  if (!unique.length) return { success: false, error: t.errNothingSelected }
  const d = Math.trunc(delta)
  if (!d) return { success: false, error: t.errZeroDelta }
  if (Math.abs(d) > INT32_MAX) return { success: false, error: 'Зміна залишку перевищує допустимий діапазон' }
  const { recordStockMovement } = await import('@/lib/shop/stock-ledger')
  const { withDbClient } = await import('@/lib/db')
  const { plain, skipped } = await splitVariantProducts(unique)
  if (plain.length > 0) {
    await withDbClient(async (client) => {
      // BUGFIX: the ledger used to record the REQUESTED delta even when
      // GREATEST(0, …) clamped the result — record the ACTUAL delta. Also
      // keeps the stock_status text consistent (was stuck on 'В наявності'
      // after the stock hit zero).
      // Lock-then-update (audit P2, 3.4.96): SELECT ... FOR UPDATE first —
      // the old single-statement CTE read qty_before from the
      // statement-start snapshot while EvalPlanQual applied the UPDATE on
      // the newest row version, so concurrent adjusts wrote inflated ledger
      // deltas. ORDER BY id locks the set in a deterministic order, so two
      // overlapping bulk adjusts cannot deadlock each other.
      const locked = await client.query<{ id: number; quantity: number }>(
        'SELECT id, quantity FROM products WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE',
        [plain],
      )
      const qtyBeforeById = new Map(locked.rows.map((r) => [Number(r.id), Number(r.quantity)]))
      const res = await client.query<{ id: number; qty_after: number }>(
        `UPDATE products p SET
           quantity = GREATEST(0, p.quantity + $1),
           is_in_stock = GREATEST(0, p.quantity + $1) > 0,
           stock_status = CASE
             WHEN GREATEST(0, p.quantity + $1) = 0 THEN 'Немає в наявності'
             WHEN p.stock_status = 'Немає в наявності' THEN 'В наявності'
             ELSE p.stock_status
           END,
           updated_at = NOW()
         WHERE p.id = ANY($2::int[])
         RETURNING p.id, p.quantity AS qty_after`,
        [d, plain],
      )
      for (const row of res.rows) {
        const qtyBefore = qtyBeforeById.get(Number(row.id))
        if (qtyBefore === undefined) {
          // Unreachable: the UPDATE covers exactly the locked set in the
          // same transaction. Fail loudly instead of writing a wrong delta.
          throw new Error(`Stock ledger: no locked row for updated product ${Number(row.id)}`)
        }
        const actualDelta = Number(row.qty_after) - qtyBefore
        await recordStockMovement(
          {
            productId: Number(row.id),
            delta: actualDelta,
            quantityAfter: Number(row.qty_after),
            reason,
            actor: user.name,
          },
          client,
        )
      }
    })
  }
  revalidatePath('/admin/products')
  revalidateStorefront()
  return { success: true, skipped }
}

export async function bulkSetProductCategory(ids: number[], categoryId: number) {
  await assertWritePermission('products')
  const unique = uniqueIds(ids)
  if (!unique.length) return { success: false, error: 'Нічого не вибрано' }
  if (!Number.isInteger(categoryId) || categoryId < 1) return { success: false, error: 'Категорія не задана' }
  // Validate BEFORE the destructive delete: an unchecked category id used to
  // wipe every link first and then insert a dangling reference, silently
  // unlisting up to 200 products from all categories. The delete+insert
  // itself already runs in one transaction.
  const [cat] = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, categoryId)).limit(1)
  if (!cat) return { success: false, error: `Категорію #${categoryId} не знайдено` }
  await withDbClient(async (client) => {
    const tx = dbForClient(client)
    await tx.delete(productCategory).where(inArray(productCategory.productId, unique))
    await tx.insert(productCategory).values(unique.map((productId) => ({ productId, categoryId })))
  })
  revalidatePath('/admin/products')
  revalidateStorefront()
  return { success: true }
}

export async function getStockMovements(productId: number, limit = 50) {
  await assertPermission('products')
  const { pool } = await import('@/lib/db')
  try {
    const res = await pool.query(
      `SELECT id, product_id, variant_id, delta, quantity_after, reason, order_id, actor, note, created_at
       FROM stock_movements WHERE product_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [productId, Math.min(200, Math.max(1, limit))],
    )
    return res.rows as {
      id: number
      product_id: number
      variant_id: number | null
      delta: number
      quantity_after: number | null
      reason: string
      order_id: number | null
      actor: string | null
      note: string | null
      created_at: string
    }[]
  } catch {
    return []
  }
}
