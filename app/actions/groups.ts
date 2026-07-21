'use server'

import { db } from '@/lib/db'
import {
  productGroups,
  productGroupItems,
  siteGroups,
  marketplaceCategories,
} from '@/lib/db/schema'
import { asc, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { assertPermission } from '@/lib/session'

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
    .slice(0, 100) || 'group'
}

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
  return null
}

export async function createGroup(input: GroupInput) {
  await assertPermission('groups')
  const error = validate(input)
  if (error) return { success: false, error }

  await db.insert(productGroups).values({
    nameUk: input.nameUk.trim(),
    nameRu: input.nameRu.trim(),
    slug: slugify(input.nameUk),
    descriptionUk: input.descriptionUk || null,
    descriptionRu: input.descriptionRu || null,
    sortOrder: input.sortOrder ?? 0,
    isActive: input.isActive ?? true,
  })
  revalidatePath('/admin/groups')
  return { success: true }
}

export async function updateGroup(id: number, input: GroupInput) {
  await assertPermission('groups')
  const error = validate(input)
  if (error) return { success: false, error }

  await db
    .update(productGroups)
    .set({
      nameUk: input.nameUk.trim(),
      nameRu: input.nameRu.trim(),
      slug: slugify(input.nameUk),
      descriptionUk: input.descriptionUk || null,
      descriptionRu: input.descriptionRu || null,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
      updatedAt: new Date(),
    })
    .where(eq(productGroups.id, id))
  revalidatePath('/admin/groups')
  return { success: true }
}

export async function deleteGroup(id: number) {
  await assertPermission('groups')
  try {
    await db.delete(productGroupItems).where(eq(productGroupItems.groupId, id))
    await db.delete(productGroups).where(eq(productGroups.id, id))
    revalidatePath('/admin/groups')
    return { success: true as const, error: undefined as string | undefined }
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : 'Ошибка удаления' }
  }
}

export async function toggleGroupActive(id: number, isActive: boolean) {
  await assertPermission('groups')
  await db
    .update(productGroups)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(productGroups.id, id))
  revalidatePath('/admin/groups')
  return { success: true }
}
