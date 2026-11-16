'use server'

import { db, dbForClient, withDbClient } from '@/lib/db'
import {
  productGroups,
  productGroupItems,
  promotions,
  siteGroups,
  marketplaceCategories,
} from '@/lib/db/schema'
import { and, asc, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { assertPermission, assertWritePermission } from '@/lib/session'
import { slugify } from '@/lib/text'
import { ensureUniqueSlug } from '@/lib/unique-slug'
import { withSlugRetry } from '@/lib/product-slug'
import { ADMIN_MAX_LEN, INT32_MAX, adminStringTooLong, toIntInRange } from '@/lib/shop/checkout-validation'

// SECURITY: these three reads had no permission check — reachable directly
// as server actions regardless of which page imports them. Only ever called
// from admin pages (the storefront's own homepage-section/marketplace-sync
// queries live elsewhere), so a straight guard is safe here.
export async function getGroups() {
  await assertPermission('groups')
  const [rows, counts] = await Promise.all([
    db.select().from(productGroups).orderBy(asc(productGroups.sortOrder), asc(productGroups.id)),
    db
      .select({
        groupId: productGroupItems.groupId,
        count: sql<number>`count(*)::int`,
      })
      .from(productGroupItems)
      .groupBy(productGroupItems.groupId),
  ])
  const countMap = new Map(counts.map((c) => [c.groupId, c.count]))
  return rows.map((g) => ({ ...g, productCount: countMap.get(g.id) ?? 0 }))
}

export async function getSiteGroups() {
  await assertPermission('groups')
  return db.select().from(siteGroups).orderBy(asc(siteGroups.sortOrder))
}

export async function getMarketplaceCategories() {
  await assertPermission('groups')
  return db.select().from(marketplaceCategories).orderBy(asc(marketplaceCategories.id))
}

export type GroupInput = {
  nameUk: string
  nameRu: string
  descriptionUk?: string | null
  descriptionRu?: string | null
  sortOrder?: number
  isActive?: boolean
}

function validate(input: GroupInput): string | null {
  if (!input.nameRu?.trim() || !input.nameUk?.trim()) {
    return 'Название группы обязательно на обоих языках'
  }
  if (
    adminStringTooLong(input.nameUk, ADMIN_MAX_LEN.groupName) ||
    adminStringTooLong(input.nameRu, ADMIN_MAX_LEN.groupName)
  )
    return `Название группы не должно превышать ${ADMIN_MAX_LEN.groupName} символов`
  if (input.sortOrder != null && toIntInRange(input.sortOrder, -INT32_MAX - 1, INT32_MAX) == null)
    return 'Порядок сортировки должен быть целым числом в пределах int32'
  return null
}

/**
 * Unique group slug (fix 3): the old bare `slugify` let two groups share
 * one slug. Same pattern as categories (fix 4): `runner` runs the check on
 * the caller's transaction connection; the unique index remains the final
 * arbiter and callers retry on 23505 via withSlugRetry.
 */
async function generateUniqueGroupSlug(
  name: string,
  fallbackId: number,
  excludeId?: number,
  runner?: Pick<typeof db, 'select'>,
): Promise<string> {
  const tx = runner ?? db
  return ensureUniqueSlug(
    slugify(name, 'group'),
    `group-${fallbackId}`,
    async (candidate) => {
      const rows = await tx
        .select({ id: productGroups.id })
        .from(productGroups)
        .where(eq(productGroups.slug, candidate))
        .limit(1)
      return rows.length > 0 ? rows[0].id : null
    },
    excludeId,
  )
}

export async function createGroup(input: GroupInput) {
  await assertWritePermission('groups')
  const error = validate(input)
  if (error) return { success: false, error }

  const firstSlug = await generateUniqueGroupSlug(input.nameUk, Date.now())
  await withSlugRetry(firstSlug, async (slug) => {
    await db.insert(productGroups).values({
      nameUk: input.nameUk.trim(),
      nameRu: input.nameRu.trim(),
      slug,
      descriptionUk: input.descriptionUk || null,
      descriptionRu: input.descriptionRu || null,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    })
  })
  revalidatePath('/admin/groups')
  return { success: true }
}

export async function updateGroup(id: number, input: GroupInput) {
  await assertWritePermission('groups')
  const error = validate(input)
  if (error) return { success: false, error }

  // Slugs are set once at creation and kept stable across renames — the
  // same rule as categories: a rename must not change the slug. Only
  // self-heal groups that predate the slug. The read + write run inside
  // one transaction under a row lock, so a concurrent save cannot
  // interleave a stale slug; on a 23505 race the retry uses the bumped
  // suffix.
  const firstSlug = await generateUniqueGroupSlug(input.nameUk, id, id)
  const { result: updated } = await withSlugRetry(firstSlug, async (candidate) => {
    return withDbClient(async (client) => {
      const tx = dbForClient(client)
      const [current] = await tx
        .select({ slug: productGroups.slug })
        .from(productGroups)
        .where(eq(productGroups.id, id))
        .for('update')
        .limit(1)
      if (!current) return null
      const slug = current.slug || candidate
      const rows = await tx
        .update(productGroups)
        .set({
          nameUk: input.nameUk.trim(),
          nameRu: input.nameRu.trim(),
          slug,
          descriptionUk: input.descriptionUk || null,
          descriptionRu: input.descriptionRu || null,
          sortOrder: input.sortOrder ?? 0,
          isActive: input.isActive ?? true,
          updatedAt: new Date(),
        })
        .where(eq(productGroups.id, id))
        .returning({ id: productGroups.id })
      return rows.length > 0 ? rows[0] : null
    })
  })
  if (!updated) return { success: false, error: 'Группа не найдена' }
  revalidatePath('/admin/groups')
  return { success: true }
}

export async function deleteGroup(id: number) {
  await assertWritePermission('groups')
  try {
    const deleted = await db.transaction(async (tx) => {
      // A group targeted by a promotion must not vanish silently: removing
      // its id from target_group_ids would narrow the promo's targeting,
      // and when it was the promo's only group the promo would stop
      // applying at all (stuck at "not_applicable" with no warning).
      // Same precedent as deleteCategory refusing on children — refuse
      // with a clear message naming the promos; the admin edits the promo
      // first, then deletes the group. Checked inside the transaction so
      // a promo cannot start targeting the group mid-delete.
      const blocking = await tx
        .select({ id: promotions.id, name: promotions.name })
        .from(promotions)
        .where(
          and(
            eq(promotions.targetType, 'groups'),
            sql`${promotions.targetGroupIds} @> ${JSON.stringify([id])}::jsonb`,
          ),
        )
      if (blocking.length > 0) {
        const names = blocking.map((p) => p.name?.trim() || `#${p.id}`).join(', ')
        throw new Error(`Группа используется в акциях: ${names}. Сначала измените или удалите эти акции.`)
      }
      await tx.delete(productGroupItems).where(eq(productGroupItems.groupId, id))
      return tx.delete(productGroups).where(eq(productGroups.id, id)).returning({ id: productGroups.id })
    })
    if (deleted.length === 0) return { success: false as const, error: 'Группа не найдена' }
    revalidatePath('/admin/groups')
    return { success: true as const, error: undefined as string | undefined }
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : 'Ошибка удаления' }
  }
}

export async function toggleGroupActive(id: number, isActive: boolean) {
  await assertWritePermission('groups')
  const updated = await db
    .update(productGroups)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(productGroups.id, id))
    .returning({ id: productGroups.id })
  if (updated.length === 0) return { success: false, error: 'Группа не найдена' }
  revalidatePath('/admin/groups')
  return { success: true }
}
