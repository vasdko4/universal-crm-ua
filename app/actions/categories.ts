'use server'

import { db, dbForClient, withDbClient } from '@/lib/db'
import { categories, productCategory } from '@/lib/db/schema'
import { asc, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { assertPermission, assertWritePermission } from '@/lib/session'
import { revalidateStorefront } from '@/lib/shop/cache'
import { slugify } from '@/lib/text'
import { ensureUniqueSlug } from '@/lib/unique-slug'
import { withSlugRetry } from '@/lib/product-slug'
import { ADMIN_MAX_LEN, INT32_MAX, adminStringTooLong, toIntInRange } from '@/lib/shop/checkout-validation'

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
  if (
    adminStringTooLong(input.nameUk, ADMIN_MAX_LEN.categoryName) ||
    adminStringTooLong(input.nameRu, ADMIN_MAX_LEN.categoryName)
  )
    return `Название категории не должно превышать ${ADMIN_MAX_LEN.categoryName} символов`
  if (input.sortOrder != null && toIntInRange(input.sortOrder, -INT32_MAX - 1, INT32_MAX) == null)
    return 'Порядок сортировки должен быть целым числом в пределах int32'
  return null
}

/**
 * Unique category slug (fix 4): the old bare `slugify` let two categories
 * share one slug. `runner` runs the check on the caller's transaction
 * connection; the unique index remains the final arbiter and callers retry
 * on 23505 via withSlugRetry.
 */
async function generateUniqueCategorySlug(
  name: string,
  fallbackId: number,
  excludeId?: number,
  runner?: Pick<typeof db, 'select'>,
): Promise<string> {
  const tx = runner ?? db
  return ensureUniqueSlug(
    slugify(name, 'category'),
    `category-${fallbackId}`,
    async (candidate) => {
      const rows = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.slug, candidate))
        .limit(1)
      return rows.length > 0 ? rows[0].id : null
    },
    excludeId,
  )
}

export async function createCategory(input: CategoryInput) {
  await assertWritePermission('categories')
  const error = validate(input)
  if (error) return { success: false, error }

  const firstSlug = await generateUniqueCategorySlug(input.nameUk, Date.now())
  await withSlugRetry(firstSlug, async (slug) => {
    await db.insert(categories).values({
      nameUk: input.nameUk.trim(),
      nameRu: input.nameRu.trim(),
      slug,
      descriptionUk: input.descriptionUk || null,
      descriptionRu: input.descriptionRu || null,
      parentId: input.parentId ?? null,
      isVisible: input.isVisible ?? true,
      sortOrder: input.sortOrder ?? 0,
      image: input.image || null,
    })
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

  // Slugs are set once at creation and kept stable across renames — the
  // same rule as products: a rename must not break links/SEO already
  // shared or indexed. Only self-heal categories that predate the slug.
  // The read + write run inside one transaction under a row lock, so a
  // concurrent save cannot interleave a stale slug; on a 23505 race the
  // retry uses the bumped suffix.
  const firstSlug = await generateUniqueCategorySlug(input.nameUk, id, id)
  const { result: updated } = await withSlugRetry(firstSlug, async (candidate) => {
    return withDbClient(async (client) => {
      const tx = dbForClient(client)
      const [current] = await tx
        .select({ slug: categories.slug })
        .from(categories)
        .where(eq(categories.id, id))
        .for('update')
        .limit(1)
      if (!current) return null
      const slug = current.slug || candidate
      const rows = await tx
        .update(categories)
        .set({
          nameUk: input.nameUk.trim(),
          nameRu: input.nameRu.trim(),
          slug,
          descriptionUk: input.descriptionUk || null,
          descriptionRu: input.descriptionRu || null,
          parentId: input.parentId ?? null,
          isVisible: input.isVisible ?? true,
          sortOrder: input.sortOrder ?? 0,
          image: input.image || null,
          updatedAt: new Date(),
        })
        .where(eq(categories.id, id))
        .returning({ id: categories.id })
      return rows.length > 0 ? rows[0] : null
    })
  })
  if (!updated) return { success: false, error: 'Категория не найдена' }
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

  const deleted = await db.transaction(async (tx) => {
    await tx.delete(productCategory).where(eq(productCategory.categoryId, id))
    return tx.delete(categories).where(eq(categories.id, id)).returning({ id: categories.id })
  })
  if (deleted.length === 0) return { success: false, error: 'Категория не найдена' }
  revalidatePath('/admin/categories')
  revalidatePath('/admin/products')
  revalidateStorefront()
  return { success: true }
}

export async function toggleCategoryVisibility(id: number, isVisible: boolean) {
  await assertWritePermission('categories')
  const updated = await db
    .update(categories)
    .set({ isVisible, updatedAt: new Date() })
    .where(eq(categories.id, id))
    .returning({ id: categories.id })
  if (updated.length === 0) return { success: false, error: 'Категория не найдена' }
  revalidatePath('/admin/categories')
  revalidateStorefront()
  return { success: true }
}
