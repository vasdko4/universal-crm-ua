'use server'

import { db } from '@/lib/db'
import { pages } from '@/lib/db/schema'
import { and, count, desc, eq, ilike } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { slugify } from '@/lib/slug'
import { assertPermission } from '@/lib/session'

export type PageInput = {
  title: string
  titleRu?: string | null
  slug?: string
  content?: string
  contentRu?: string | null
  excerpt?: string
  excerptRu?: string | null
  coverImage?: string | null
  template?: string
  status?: 'draft' | 'published'
  showInMenu?: boolean
  menuTitle?: string | null
  sortOrder?: number
  metaTitle?: string | null
  metaDescription?: string | null
}

export type PageListParams = {
  search?: string
  status?: 'all' | 'draft' | 'published'
  page?: number
  pageSize?: number
}

// SECURITY: this admin listing (default status 'all') had no permission
// check, even though it's directly reachable as a server action regardless
// of which page imports it — so anyone could call it to read draft pages.
// Public callers (/api/pages) now use getPublicPublishedPages() below
// instead, which is not permission-gated but always hardcodes 'published'.
export async function getPages(params: PageListParams = {}) {
  await assertPermission('pages')
  const { search = '', status = 'all', page = 1, pageSize = 10 } = params
  const conditions = []
  if (search.trim()) conditions.push(ilike(pages.title, `%${search.trim()}%`))
  if (status !== 'all') conditions.push(eq(pages.status, status))
  const where = conditions.length ? and(...conditions) : undefined

  const [rows, totalRows] = await Promise.all([
    db.select().from(pages).where(where).orderBy(desc(pages.updatedAt)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ value: count() }).from(pages).where(where),
  ])
  const total = totalRows[0]?.value ?? 0
  return { items: rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
}

export async function getPageById(id: number) {
  await assertPermission('pages')
  const rows = await db.select().from(pages).where(eq(pages.id, id)).limit(1)
  return rows[0] ?? null
}

// Public, unauthenticated equivalents for /api/pages — always
// published-only, never draft content.
export async function getPublicPublishedPages(params: {
  search?: string
  page?: number
  pageSize?: number
} = {}) {
  const { search = '', page = 1, pageSize = 10 } = params
  const conditions = [eq(pages.status, 'published')]
  if (search.trim()) conditions.push(ilike(pages.title, `%${search.trim()}%`))
  const where = and(...conditions)

  const [rows, totalRows] = await Promise.all([
    db.select().from(pages).where(where).orderBy(desc(pages.updatedAt)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ value: count() }).from(pages).where(where),
  ])
  const total = totalRows[0]?.value ?? 0
  return { items: rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
}

export async function getPublicPublishedPageById(id: number) {
  const rows = await db
    .select()
    .from(pages)
    .where(and(eq(pages.id, id), eq(pages.status, 'published')))
    .limit(1)
  return rows[0] ?? null
}

async function ensureSlug(desired: string, excludeId?: number): Promise<string> {
  let base = slugify(desired) || 'page'
  let slug = base
  let i = 1
  while (true) {
    const rows = await db.select({ id: pages.id }).from(pages).where(eq(pages.slug, slug)).limit(1)
    const existing = rows[0]
    if (!existing || existing.id === excludeId) return slug
    slug = `${base}-${i++}`
  }
}

function validate(input: PageInput): string | null {
  if (!input.title?.trim()) return 'Заголовок обязателен'
  return null
}

export async function createPage(input: PageInput) {
  await assertPermission('pages')
  const error = validate(input)
  if (error) return { success: false, error }
  const slug = await ensureSlug(input.slug?.trim() || input.title)
  const isPublished = input.status === 'published'
  await db.insert(pages).values({
    title: input.title.trim(),
    titleRu: input.titleRu?.trim() || null,
    slug,
    content: input.content ?? '',
    contentRu: input.contentRu ?? null,
    excerpt: input.excerpt ?? '',
    excerptRu: input.excerptRu ?? null,
    coverImage: input.coverImage ?? null,
    template: input.template ?? 'default',
    status: input.status ?? 'draft',
    showInMenu: input.showInMenu ?? false,
    menuTitle: input.menuTitle ?? null,
    sortOrder: input.sortOrder ?? 0,
    metaTitle: input.metaTitle ?? null,
    metaDescription: input.metaDescription ?? null,
    publishedAt: isPublished ? new Date() : null,
  })
  revalidatePath('/admin/pages')
  return { success: true }
}

export async function updatePage(id: number, input: PageInput) {
  await assertPermission('pages')
  const error = validate(input)
  if (error) return { success: false, error }
  const current = await getPageById(id)
  if (!current) return { success: false, error: 'Страница не найдена' }
  const slug = await ensureSlug(input.slug?.trim() || input.title, id)
  const isPublished = input.status === 'published'
  await db
    .update(pages)
    .set({
      title: input.title.trim(),
      titleRu: input.titleRu?.trim() || null,
      slug,
      content: input.content ?? '',
      contentRu: input.contentRu ?? null,
      excerpt: input.excerpt ?? '',
      excerptRu: input.excerptRu ?? null,
      coverImage: input.coverImage ?? null,
      template: input.template ?? 'default',
      status: input.status ?? 'draft',
      showInMenu: input.showInMenu ?? false,
      menuTitle: input.menuTitle ?? null,
      sortOrder: input.sortOrder ?? 0,
      metaTitle: input.metaTitle ?? null,
      metaDescription: input.metaDescription ?? null,
      publishedAt: isPublished ? current.publishedAt ?? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(pages.id, id))
  revalidatePath('/admin/pages')
  return { success: true }
}

export async function togglePageStatus(id: number, status: 'draft' | 'published') {
  await assertPermission('pages')
  await db
    .update(pages)
    .set({ status, publishedAt: status === 'published' ? new Date() : null, updatedAt: new Date() })
    .where(eq(pages.id, id))
  revalidatePath('/admin/pages')
  return { success: true }
}

export async function deletePage(id: number) {
  await assertPermission('pages')
  await db.delete(pages).where(eq(pages.id, id))
  revalidatePath('/admin/pages')
  return { success: true }
}
