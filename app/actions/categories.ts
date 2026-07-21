'use server'

import { db } from '@/lib/db'
import { categories, productCategory } from '@/lib/db/schema'
import { asc, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { assertPermission } from '@/lib/session'
import { revalidateStorefront } from '@/lib/shop/cache'

function slugify(text: string) {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', ґ: 'g', д: 'd', е: 'e', є: 'ie', ё: 'e',
    ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm',
    н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh',
    ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ы: 'y', э: 'e', ю: 'iu', я: 'ia',
    ь: '', ъ: '',
  }
  return text
    .toLowerCase()
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'category'
}

// SECURITY: no permission check — reachable directly as a server action
// regardless of which page imports it, exposing hidden/invisible categories
// (the storefront's own category list uses a separate, already-filtered
// query). Only ever called from admin pages, so a straight guard is safe.
export async function getCategories() {
  await assertPermission('categories')
  const [rows, counts] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.id)),
    db
      .select({
        categoryId: productCategory.categoryId,
        count: sql<number>`count(*)::int`,
      })
      .from(productCategory)
      .groupBy(productCategory.categoryId),
  ])
  const countMap = new Map(counts.map((c) => [c.categoryId, c.count]))
  return rows.map((c) => ({ ...c, productCount: countMap.get(c.id) ?? 0 }))
}

export type CategoryInput = {
  nameUk: string
  nameRu: string
  descriptionUk?: string | null
  descriptionRu?: string | null
  parentId?: number | null
  isVisible?: boolean
  sortOrder?: number
}

function validate(input: CategoryInput): string | null {
  if (!input.nameRu?.trim() || !input.nameUk?.trim()) {
    return 'Название категории обязательно на обоих языках'
  }
  return null
}

export async function createCategory(input: CategoryInput) {
  await assertPermission('categories')
  const error = validate(input)
  if (error) return { success: false, error }

  await db.insert(categories).values({
    nameUk: input.nameUk.trim(),
    nameRu: input.nameRu.trim(),
    slug: slugify(input.nameUk),
    descriptionUk: input.descriptionUk || null,
    descriptionRu: input.descriptionRu || null,
    parentId: input.parentId ?? null,
    isVisible: input.isVisible ?? true,
    sortOrder: input.sortOrder ?? 0,
  })
  revalidatePath('/admin/categories')
  revalidateStorefront()
  return { success: true }
}

export async function updateCategory(id: number, input: CategoryInput) {
  await assertPermission('categories')
  const error = validate(input)
  if (error) return { success: false, error }

  if (input.parentId === id) return { success: false, error: 'Категория не может быть родителем самой себя' }

  await db
    .update(categories)
    .set({
      nameUk: input.nameUk.trim(),
      nameRu: input.nameRu.trim(),
      slug: slugify(input.nameUk),
      descriptionUk: input.descriptionUk || null,
      descriptionRu: input.descriptionRu || null,
      parentId: input.parentId ?? null,
      isVisible: input.isVisible ?? true,
      sortOrder: input.sortOrder ?? 0,
      updatedAt: new Date(),
    })
    .where(eq(categories.id, id))
  revalidatePath('/admin/categories')
  revalidateStorefront()
  return { success: true }
}

export async function deleteCategory(id: number) {
  await assertPermission('categories')
  const [child] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.parentId, id))
    .limit(1)
  if (child) return { success: false, error: 'Сначала удалите или переместите подкатегории' }

  await db.delete(productCategory).where(eq(productCategory.categoryId, id))
  await db.delete(categories).where(eq(categories.id, id))
  revalidatePath('/admin/categories')
  revalidatePath('/admin/products')
  revalidateStorefront()
  return { success: true }
}

export async function toggleCategoryVisibility(id: number, isVisible: boolean) {
  await assertPermission('categories')
  await db
    .update(categories)
    .set({ isVisible, updatedAt: new Date() })
    .where(eq(categories.id, id))
  revalidatePath('/admin/categories')
  revalidateStorefront()
  return { success: true }
}
