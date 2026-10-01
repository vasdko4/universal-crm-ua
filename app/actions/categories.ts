'use server'

import { db } from '@/lib/db'
import { categories, productCategory } from '@/lib/db/schema'
import { asc, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { assertPermission, assertWritePermission } from '@/lib/session'
import { revalidateStorefront } from '@/lib/shop/cache'
import { slugify } from '@/lib/text'

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
  image?: string | null
}

function validate(input: CategoryInput): string | null {
  if (!input.nameRu?.trim() || !input.nameUk?.trim()) {
    return 'Название категории обязательно на обоих языках'
  }
  return null
}

export async function createCategory(input: CategoryInput) {
  await assertWritePermission('categories')
  const error = validate(input)
  if (error) return { success: false, error }

  await db.insert(categories).values({
    nameUk: input.nameUk.trim(),
    nameRu: input.nameRu.trim(),
    slug: slugify(input.nameUk, 'category'),
    descriptionUk: input.descriptionUk || null,
    descriptionRu: input.descriptionRu || null,
    parentId: input.parentId ?? null,
    isVisible: input.isVisible ?? true,
    sortOrder: input.sortOrder ?? 0,
    image: input.image || null,
  })
  revalidatePath('/admin/categories')
  revalidateStorefront()
  return { success: true }
}

/** All descendant category ids (children, grandchildren, …) via visited-set BFS. */
async function getCategoryDescendantIds(rootId: number): Promise<number[]> {
  const visited = new Set<number>([rootId])
  const queue = [rootId]
  const out: number[] = []
  while (queue.length > 0) {
    const current = queue.shift()!
    const children = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.parentId, current))
    for (const c of children) {
      if (visited.has(c.id)) continue
      visited.add(c.id)
      out.push(c.id)
      queue.push(c.id)
    }
  }
  return out
}

export async function updateCategory(id: number, input: CategoryInput) {
  await assertWritePermission('categories')
  const error = validate(input)
  if (error) return { success: false, error }

  if (input.parentId === id) return { success: false, error: 'Категория не может быть родителем самой себя' }
  // BUGFIX: only the self-parent case was rejected. A↔B cycles were creatable
  // in two edits and sent the storefront category BFS
  // (_getCategoryAndDescendantIds) into an infinite loop (Vercel timeout).
  // Reject any parent that is a descendant of the category being moved.
  if (input.parentId != null) {
    const descendants = await getCategoryDescendantIds(id)
    if (descendants.includes(input.parentId)) {
      return { success: false, error: 'Категория не может быть вложена в свою подкатегорию' }
    }
  }

  await db
    .update(categories)
    .set({
      nameUk: input.nameUk.trim(),
      nameRu: input.nameRu.trim(),
      slug: slugify(input.nameUk, 'category'),
      descriptionUk: input.descriptionUk || null,
      descriptionRu: input.descriptionRu || null,
      parentId: input.parentId ?? null,
      isVisible: input.isVisible ?? true,
      sortOrder: input.sortOrder ?? 0,
      image: input.image || null,
      updatedAt: new Date(),
    })
    .where(eq(categories.id, id))
  revalidatePath('/admin/categories')
  revalidateStorefront()
  return { success: true }
}

export async function deleteCategory(id: number) {
  await assertWritePermission('categories')
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
  await assertWritePermission('categories')
  await db
    .update(categories)
    .set({ isVisible, updatedAt: new Date() })
    .where(eq(categories.id, id))
  revalidatePath('/admin/categories')
  revalidateStorefront()
  return { success: true }
}
