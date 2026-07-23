'use server'

import { db } from '@/lib/db'
import {
  products,
  productCategory,
  productGroupItems,
  productCharacteristics,
  productVariants,
} from '@/lib/db/schema'
import type { ProductOption, VariantOptions } from '@/lib/db/schema'
import { and, asc, desc, eq, ilike, inArray, isNull, isNotNull, or, sql, type SQL } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { assertPermission } from '@/lib/session'
import { revalidateStorefront } from '@/lib/shop/cache'
import { auditLog } from '@/lib/audit-log'

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
  const { search, categoryId, status = 'all', sort = 'newest', page = 1, perPage = 10 } = filters

  const conditions: SQL[] = [isNull(products.deletedAt)]

  if (search?.trim()) {
    const q = `%${search.trim()}%`
    const searchCond = or(
      ilike(products.nameRu, q),
      ilike(products.nameUk, q),
      ilike(products.sku, q)
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
  categoryIds?: number[]
  groupIds?: number[]
  characteristics?: { name: string; value: string }[]
  options?: ProductOption[]
  variants?: VariantInput[]
}

function validateProduct(input: ProductInput): string | null {
  if (!input.nameRu?.trim() && !input.nameUk?.trim()) {
    return 'Укажите название товара хотя бы на одном языке'
  }
  const price = Number(input.price)
  if (Number.isNaN(price) || price < 0) return 'Цена должна быть неотрицательным числом'
  if (!Number.isInteger(input.quantity) || input.quantity < 0)
    return 'Количество должно быть неотрицательным целым числом'
  if (input.oldPrice != null && input.oldPrice !== '' && (Number.isNaN(Number(input.oldPrice)) || Number(input.oldPrice) < 0))
    return 'Старая цена должна быть неотрицательным числом'
  return null
}

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

// Keep only variants whose options match the defined axes and have a price.
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
    .filter((v) => Object.keys(v.options).length === axisNames.length && v.price !== '' && !Number.isNaN(Number(v.price)))
}

function toProductRow(input: ProductInput) {
  const num = (v: string | null | undefined) => (v == null || v === '' ? null : v)
  const options = cleanOptions(input.options)
  const variants = cleanVariants(input)
  const hasVariants = variants.length > 0
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
    stockStatus: aggQty > 0 ? input.stockStatus || 'В наличии' : 'Нет в наличии',
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
    isPopular: input.isPopular ?? false,
    purchasesBoost: Math.max(0, Math.trunc(input.purchasesBoost ?? 0)),
    metaTitleUk: input.metaTitleUk || null,
    metaTitleRu: input.metaTitleRu || null,
    metaDescriptionUk: input.metaDescriptionUk || null,
    metaDescriptionRu: input.metaDescriptionRu || null,
    updatedAt: new Date(),
  }
}

async function syncRelations(productId: number, input: ProductInput) {
  await db.delete(productCategory).where(eq(productCategory.productId, productId))
  if (input.categoryIds && input.categoryIds.length > 0) {
    await db
      .insert(productCategory)
      .values(input.categoryIds.map((categoryId) => ({ productId, categoryId })))
  }

  await db.delete(productGroupItems).where(eq(productGroupItems.productId, productId))
  if (input.groupIds && input.groupIds.length > 0) {
    await db
      .insert(productGroupItems)
      .values(input.groupIds.map((groupId, i) => ({ productId, groupId, sortOrder: i })))
  }

  await db.delete(productCharacteristics).where(eq(productCharacteristics.productId, productId))
  const chars = (input.characteristics || []).filter((c) => c.name.trim() && c.value.trim())
  if (chars.length > 0) {
    await db.insert(productCharacteristics).values(
      chars.map((c, i) => ({
        productId,
        name: c.name.trim(),
        value: c.value.trim(),
        sortOrder: i,
      }))
    )
  }

  // Replace the variant matrix wholesale (simple + safe for the admin UI).
  await db.delete(productVariants).where(eq(productVariants.productId, productId))
  const variants = cleanVariants(input)
  if (variants.length > 0) {
    await db.insert(productVariants).values(
      variants.map((v, i) => {
        const qty = Math.max(0, Math.trunc(v.quantity || 0))
        const old = v.oldPrice == null || v.oldPrice === '' ? null : v.oldPrice
        return {
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
      })
    )
  }
}

export async function createProduct(input: ProductInput) {
  const user = await assertPermission('products')
  const error = validateProduct(input)
  if (error) return { success: false, error }

  const [created] = await db.insert(products).values(toProductRow(input)).returning({ id: products.id })
  await syncRelations(created.id, input)

  void auditLog({
    userId: user.id, userName: user.name, userEmail: user.email,
    action: 'create', entity: 'product', entityId: created.id,
    details: `Создан товар «${input.nameUk || input.nameRu || ''}»`,
  })

  revalidatePath('/admin/products')
  revalidateStorefront()
  return { success: true, id: created.id }
}

export async function updateProduct(id: number, input: ProductInput) {
  const user = await assertPermission('products')
  const error = validateProduct(input)
  if (error) return { success: false, error }

  const [existing] = await db.select({ id: products.id }).from(products).where(eq(products.id, id))
  if (!existing) return { success: false, error: 'Товар не найден' }

  await db.update(products).set(toProductRow(input)).where(eq(products.id, id))
  await syncRelations(id, input)

  void auditLog({
    userId: user.id, userName: user.name, userEmail: user.email,
    action: 'update', entity: 'product', entityId: id,
    details: `Изменён товар «${input.nameUk || input.nameRu || ''}»`,
  })

  revalidatePath('/admin/products')
  revalidatePath(`/admin/products/${id}/edit`)
  revalidatePath(`/product/${id}`)
  revalidateStorefront(id)
  return { success: true, id }
}

export async function softDeleteProducts(ids: number[]) {
  const user = await assertPermission('products')
  if (ids.length === 0) return { success: false, error: 'Ничего не выбрано' }
  await db.update(products).set({ deletedAt: new Date() }).where(inArray(products.id, ids))

  void auditLog({
    userId: user.id, userName: user.name, userEmail: user.email,
    action: 'delete', entity: 'product',
    details: `Товары перемещены в корзину: ${ids.join(', ')}`,
  })

  revalidatePath('/admin/products')
  revalidatePath('/admin/trash')
  revalidateStorefront()
  return { success: true }
}

export async function setProductsVisibility(ids: number[], isVisible: boolean) {
  await assertPermission('products')
  if (ids.length === 0) return { success: false, error: 'Ничего не выбрано' }
  await db
    .update(products)
    .set({ isVisible, updatedAt: new Date() })
    .where(inArray(products.id, ids))
  revalidatePath('/admin/products')
  revalidateStorefront()
  return { success: true }
}

export async function duplicateProduct(id: number) {
  await assertPermission('products')
  const source = await getProduct(id)
  if (!source) return { success: false, error: 'Товар не найден' }

  const { id: _id, createdAt, updatedAt, deletedAt, categoryIds, groupIds, characteristics, viewsCount, ordersCount, ...rest } = source

  const [created] = await db
    .insert(products)
    .values({
      ...rest,
      nameRu: rest.nameRu ? `${rest.nameRu} (копия)` : null,
      nameUk: rest.nameUk ? `${rest.nameUk} (копія)` : null,
      sku: rest.sku ? `${rest.sku}-COPY` : null,
    })
    .returning({ id: products.id })

  await syncRelations(created.id, {
    price: rest.price,
    quantity: rest.quantity,
    categoryIds,
    groupIds,
    characteristics: characteristics.map((c) => ({ name: c.name, value: c.value })),
  })

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
  await assertPermission('trash')
  if (ids.length === 0) return { success: false, error: 'Ничего не выбрано' }
  await db.update(products).set({ deletedAt: null }).where(inArray(products.id, ids))
  revalidatePath('/admin/products')
  revalidatePath('/admin/trash')
  revalidateStorefront()
  return { success: true }
}

export async function permanentlyDeleteProducts(ids: number[]) {
  await assertPermission('trash')
  if (ids.length === 0) return { success: false, error: 'Ничего не выбрано' }
  await db.delete(productCategory).where(inArray(productCategory.productId, ids))
  await db.delete(productGroupItems).where(inArray(productGroupItems.productId, ids))
  await db.delete(productCharacteristics).where(inArray(productCharacteristics.productId, ids))
  await db
    .delete(products)
    .where(and(inArray(products.id, ids), isNotNull(products.deletedAt)))
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
  await assertPermission('trash')
  const trashed = await db
    .select({ id: products.id })
    .from(products)
    .where(isNotNull(products.deletedAt))
  const ids = trashed.map((t) => t.id)
  if (ids.length === 0) return { success: true }
  return permanentlyDeleteProducts(ids)
}
