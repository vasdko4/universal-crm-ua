'use server'

import { revalidatePath } from 'next/cache'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { db, pool } from '@/lib/db'
import { categories, importTasks, productCategory, productCharacteristics, products } from '@/lib/db/schema'
import { assertPermission } from '@/lib/session'
import {
  fetchListingPage,
  fetchProduct,
  slugify,
  withPage,
  type PromListItem,
} from '@/lib/prom-import/scraper'

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
}

// Same self-heal pattern as ensureImportTable() in app/actions/import.ts:
// adds the two extra columns this feature needs so installs whose DB
// predates this feature don't crash — no separate migration step required.
let columnsReady = false
async function ensurePromImportColumns() {
  if (columnsReady) return
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "import_tasks" (
      "id" serial PRIMARY KEY,
      "file_name" varchar(255) NOT NULL,
      "source_type" varchar(20) DEFAULT 'local' NOT NULL,
      "status" varchar(20) DEFAULT 'pending',
      "total_items" integer DEFAULT 0,
      "processed_items" integer DEFAULT 0,
      "success_items" integer DEFAULT 0,
      "failed_items" integer DEFAULT 0,
      "error_log" text,
      "started_at" timestamptz,
      "completed_at" timestamptz,
      "created_at" timestamptz DEFAULT now(),
      "updated_at" timestamptz DEFAULT now()
    )
  `)
  await pool.query(`ALTER TABLE "import_tasks" ADD COLUMN IF NOT EXISTS "source_url" text`)
  await pool.query(`ALTER TABLE "import_tasks" ADD COLUMN IF NOT EXISTS "state" jsonb`)
  columnsReady = true
}

function isPromUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return /(^|\.)prom\.ua$/.test(u.hostname)
  } catch {
    return false
  }
}

/** Starts a new Prom.ua shop import: discovers every product link, then returns a task id to poll. */
export async function startPromImport(shopUrl: string) {
  await assertPermission('import')
  const trimmed = shopUrl.trim()
  if (!isPromUrl(trimmed)) {
    return { success: false as const, error: 'Ссылка должна вести на prom.ua (страницу магазина)' }
  }
  await ensurePromImportColumns()

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

  const state: PromImportState = { shopUrl: trimmed, origin, pending, capped }
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
    // duplicate categories on every re-import).
    const match: { id: number }[] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          eq(categories.nameUk, nameUk),
          parentId === null ? isNull(categories.parentId) : eq(categories.parentId, parentId),
        ),
      )
      .limit(1)

    if (match.length > 0) {
      leafId = match[0].id
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

/** Processes the next small batch of a Prom.ua import job. Call repeatedly until `done: true`. */
export async function continuePromImport(taskId: number) {
  await assertPermission('import')
  await ensurePromImportColumns()

  const [task] = await db.select().from(importTasks).where(eq(importTasks.id, taskId)).limit(1)
  if (!task || task.sourceType !== 'prom') {
    return { success: false as const, error: 'Задача импорта не найдена' }
  }
  if (task.status !== 'processing') {
    return { success: true as const, done: true, processed: task.processedItems ?? 0, total: task.totalItems ?? 0 }
  }

  const state = task.state as PromImportState | null
  if (!state || !Array.isArray(state.pending)) {
    return { success: false as const, error: 'Повреждённое состояние задачи импорта' }
  }

  const batch = state.pending.slice(0, BATCH_SIZE)
  const rest = state.pending.slice(BATCH_SIZE)
  let success = 0
  let failed = 0
  const errors: string[] = []

  for (const item of batch) {
    try {
      // Same politeness delay as the discovery loop / original scrape script.
      await new Promise((r) => setTimeout(r, 400))
      const p = await fetchProduct(state.origin, item)
      if (!p) throw new Error('не удалось загрузить страницу товара')

      const leafCatId = p.breadcrumbsUk.length
        ? await ensureCategoryPath(p.breadcrumbsUk, p.breadcrumbsRu)
        : null

      const sku = p.sku?.trim() || null
      const existing: { id: number }[] = sku
        ? await db
            .select({ id: products.id })
            .from(products)
            .where(and(eq(products.sku, sku), isNull(products.deletedAt)))
            .limit(1)
        : []

      const values = {
        nameUk: p.nameUk || null,
        nameRu: p.nameRu || null,
        descriptionUk: p.descriptionUk || null,
        descriptionRu: p.descriptionRu || null,
        sku,
        price: String(p.price ?? 0),
        oldPrice: p.oldPrice != null ? String(p.oldPrice) : null,
        currency: 'UAH',
        quantity: p.inStock ? 100 : 0,
        stockStatus: p.inStock ? 'В наличии' : 'Нет в наличии',
        isInStock: p.inStock,
        image: p.images[0] || null,
        images: p.images,
      }

      let productId: number
      if (existing.length > 0) {
        await db.update(products).set(values).where(eq(products.id, existing[0].id))
        productId = existing[0].id
        // Re-imports refresh characteristics from the source rather than
        // appending duplicates.
        await db.delete(productCharacteristics).where(eq(productCharacteristics.productId, productId))
      } else {
        const insertedRows: { id: number }[] = await db.insert(products).values(values).returning({ id: products.id })
        productId = insertedRows[0].id
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

  const processedItems = (task.processedItems ?? 0) + batch.length
  const successItems = (task.successItems ?? 0) + success
  const failedItems = (task.failedItems ?? 0) + failed
  const done = rest.length === 0
  const combinedErrors = [...(task.errorLog ? task.errorLog.split('\n') : []), ...errors].slice(-50)

  await db
    .update(importTasks)
    .set({
      processedItems,
      successItems,
      failedItems,
      errorLog: combinedErrors.length > 0 ? combinedErrors.join('\n') : null,
      status: done ? 'completed' : 'processing',
      completedAt: done ? new Date() : null,
      state: { ...state, pending: rest },
      updatedAt: new Date(),
    })
    .where(eq(importTasks.id, taskId))

  if (done) {
    revalidatePath('/admin/products')
    revalidatePath('/admin/import')
    revalidatePath('/', 'layout')
  }

  return { success: true as const, done, processed: processedItems, total: task.totalItems ?? 0, success_count: successItems, failed_count: failedItems }
}

/** Prom.ua import jobs left mid-way (e.g. tab closed) so the UI can offer a "Продолжить" button. */
export async function getUnfinishedPromImports() {
  await assertPermission('import')
  await ensurePromImportColumns()
  return db
    .select()
    .from(importTasks)
    .where(and(eq(importTasks.sourceType, 'prom'), eq(importTasks.status, 'processing')))
    .orderBy(desc(importTasks.createdAt))
    .limit(10)
}
