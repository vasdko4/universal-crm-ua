'use server'

import { db, pool } from '@/lib/db'
import { importTasks, products } from '@/lib/db/schema'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { assertPermission } from '@/lib/session'

// Self-heals installs whose database was created before the import_tasks table
// was added to the schema, so /admin/import never crashes with a missing table.
let importTableReady = false
async function ensureImportTable() {
  if (importTableReady) return
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
  // schema.sql (used on first container boot) predates the Prom.ua import
  // feature and doesn't create these two columns; ensurePromImportColumns()
  // in prom-import.ts adds them via ALTER TABLE IF NOT EXISTS, but that only
  // ran from that file's own functions. On a fresh container start,
  // /admin/import calls getImportTasks() and getUnfinishedPromImports() in
  // parallel (Promise.all) — if this file's select ran before the other
  // file's ALTER committed, it crashed with "column source_url does not
  // exist" (a one-time startup race, confirmed in production logs). Self-heal
  // the columns here too so this function no longer depends on that race.
  await pool.query(`ALTER TABLE "import_tasks" ADD COLUMN IF NOT EXISTS "source_url" text`)
  await pool.query(`ALTER TABLE "import_tasks" ADD COLUMN IF NOT EXISTS "state" jsonb`)
  importTableReady = true
}

export type ImportRow = {
  name_uk?: string
  name_ru?: string
  sku?: string
  price?: string
  old_price?: string
  quantity?: string
  description_uk?: string
  description_ru?: string
  unit?: string
}

export async function getImportTasks() {
  // Was missing the same 'import' permission check that guards runImport()
  // below, so any logged-in admin-center user — regardless of role — could
  // read the import history (file names, error logs) without the import
  // permission.
  await assertPermission('import')
  await ensureImportTable()
  return db.select().from(importTasks).orderBy(desc(importTasks.createdAt)).limit(20)
}

export async function runImport(fileName: string, sourceType: 'csv' | 'xml', rows: ImportRow[]) {
  await assertPermission('import')
  if (rows.length === 0) return { success: false, error: 'Файл не содержит товаров' }
  if (rows.length > 1000) return { success: false, error: 'Максимум 1000 товаров за один импорт' }

  await ensureImportTable()

  const [task] = await db
    .insert(importTasks)
    .values({
      fileName,
      sourceType,
      status: 'processing',
      totalItems: rows.length,
      startedAt: new Date(),
    })
    .returning({ id: importTasks.id })

  let success = 0
  let failed = 0
  const errors: string[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      const nameRu = row.name_ru?.trim()
      const nameUk = row.name_uk?.trim()
      if (!nameRu && !nameUk) throw new Error('нет названия')

      const price = Number(row.price ?? 0)
      if (Number.isNaN(price) || price < 0) throw new Error('некорректная цена')

      const quantity = Math.max(0, Math.trunc(Number(row.quantity ?? 0) || 0))
      const oldPrice = row.old_price && !Number.isNaN(Number(row.old_price)) ? row.old_price : null
      const sku = row.sku?.trim() || null

      // Re-importing the same supplier feed (price/stock updates) is the
      // expected workflow here, and the preview even shows "Артикул" (SKU) as
      // a column — so match on SKU and update in place instead of always
      // inserting, which used to duplicate the whole catalog on every re-run.
      // Products without a SKU can't be matched safely, so they're always
      // inserted as new.
      const existing = sku
        ? await db
            .select({ id: products.id })
            .from(products)
            .where(and(eq(products.sku, sku), isNull(products.deletedAt)))
            .limit(1)
        : []

      if (existing.length > 0) {
        await db
          .update(products)
          .set({
            nameRu: nameRu || undefined,
            nameUk: nameUk || undefined,
            descriptionRu: row.description_ru || undefined,
            descriptionUk: row.description_uk || undefined,
            price: String(price),
            oldPrice,
            quantity,
            unit: row.unit?.trim() || 'шт',
            stockStatus: quantity > 0 ? 'В наличии' : 'Нет в наличии',
            isInStock: quantity > 0,
            updatedAt: sql`now()`,
          })
          .where(eq(products.id, existing[0].id))
      } else {
        await db.insert(products).values({
          nameRu: nameRu || null,
          nameUk: nameUk || null,
          descriptionRu: row.description_ru || null,
          descriptionUk: row.description_uk || null,
          sku,
          price: String(price),
          oldPrice,
          quantity,
          unit: row.unit?.trim() || 'шт',
          stockStatus: quantity > 0 ? 'В наличии' : 'Нет в наличии',
          isInStock: quantity > 0,
        })
      }
      success++
    } catch (e) {
      failed++
      errors.push(`Строка ${i + 1}: ${e instanceof Error ? e.message : 'ошибка'}`)
    }
  }

  await db
    .update(importTasks)
    .set({
      status: failed === rows.length ? 'failed' : 'completed',
      processedItems: rows.length,
      successItems: success,
      failedItems: failed,
      errorLog: errors.length > 0 ? errors.slice(0, 50).join('\n') : null,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(importTasks.id, task.id))

  revalidatePath('/admin/products')
  revalidatePath('/admin/import')
  return { success: true, imported: success, failed }
}
