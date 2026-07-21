'use server'

import { db } from '@/lib/db'
import { articles, articleCategories } from '@/lib/db/schema'
import { and, asc, count, desc, eq, ilike } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { slugify } from '@/lib/slug'
import { assertPermission } from '@/lib/session'

export type ArticleInput = {
  title: string
  slug?: string
  categoryId?: number | null
  excerpt?: string
  content?: string
  coverImage?: string | null
  author?: string | null
  tags?: string[]
  status?: 'draft' | 'published'
  isFeatured?: boolean
  readingMinutes?: number
  metaTitle?: string | null
  metaDescription?: string | null
}

export type ArticleListParams = {
  search?: string
  status?: 'all' | 'draft' | 'published'
  categoryId?: number | 'all'
  page?: number
  pageSize?: number
}

export async function getArticleCategories() {
  await assertPermission('articles')
  return db.select().from(articleCategories).orderBy(asc(articleCategories.sortOrder), asc(articleCategories.id))
}

// SECURITY: this admin listing (default status 'all') had no permission
// check, even though it's directly reachable as a server action regardless
// of which page imports it — so anyone could call it to read unpublished
// draft articles. Public callers (/api/articles) now use
// getPublicPublishedArticles() below instead, which is not permission-gated
// but always hardcodes status to 'published'.
export async function getArticles(params: ArticleListParams = {}) {
  await assertPermission('articles')
  const { search = '', status = 'all', categoryId = 'all', page = 1, pageSize = 10 } = params
  const conditions = []
  if (search.trim()) conditions.push(ilike(articles.title, `%${search.trim()}%`))
  if (status !== 'all') conditions.push(eq(articles.status, status))
  if (categoryId !== 'all') conditions.push(eq(articles.categoryId, categoryId as number))
  const where = conditions.length ? and(...conditions) : undefined

  const [rows, totalRows, cats] = await Promise.all([
    db.select().from(articles).where(where).orderBy(desc(articles.updatedAt)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ value: count() }).from(articles).where(where),
    getArticleCategories(),
  ])
  const catMap = new Map(cats.map((c) => [c.id, c.name]))
  const items = rows.map((a) => ({ ...a, categoryName: a.categoryId ? catMap.get(a.categoryId) ?? null : null }))
  const total = totalRows[0]?.value ?? 0
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
}

export async function getArticleById(id: number) {
  await assertPermission('articles')
  const rows = await db.select().from(articles).where(eq(articles.id, id)).limit(1)
  return rows[0] ?? null
}

// Public, unauthenticated equivalents for /api/articles — always
// published-only, never draft content. See getArticles()/getArticleById()
// above for why these are separate rather than the admin functions forcing
// safe defaults themselves.
export async function getPublicPublishedArticles(params: {
  search?: string
  categoryId?: number | 'all'
  page?: number
  pageSize?: number
} = {}) {
  const { search = '', categoryId = 'all', page = 1, pageSize = 10 } = params
  const conditions = [eq(articles.status, 'published')]
  if (search.trim()) conditions.push(ilike(articles.title, `%${search.trim()}%`))
  if (categoryId !== 'all') conditions.push(eq(articles.categoryId, categoryId as number))
  const where = and(...conditions)

  const [rows, totalRows, cats] = await Promise.all([
    db.select().from(articles).where(where).orderBy(desc(articles.updatedAt)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ value: count() }).from(articles).where(where),
    getArticleCategories(),
  ])
  const catMap = new Map(cats.map((c) => [c.id, c.name]))
  const items = rows.map((a) => ({ ...a, categoryName: a.categoryId ? catMap.get(a.categoryId) ?? null : null }))
  const total = totalRows[0]?.value ?? 0
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
}

export async function getPublicPublishedArticleById(id: number) {
  const rows = await db
    .select()
    .from(articles)
    .where(and(eq(articles.id, id), eq(articles.status, 'published')))
    .limit(1)
  return rows[0] ?? null
}

async function ensureSlug(desired: string, excludeId?: number): Promise<string> {
  const base = slugify(desired) || 'article'
  let slug = base
  let i = 1
  while (true) {
    const rows = await db.select({ id: articles.id }).from(articles).where(eq(articles.slug, slug)).limit(1)
    const existing = rows[0]
    if (!existing || existing.id === excludeId) return slug
    slug = `${base}-${i++}`
  }
}

function validate(input: ArticleInput): string | null {
  if (!input.title?.trim()) return 'Заголовок обязателен'
  return null
}

export async function createArticle(input: ArticleInput) {
  await assertPermission('articles')
  const error = validate(input)
  if (error) return { success: false, error }
  const slug = await ensureSlug(input.slug?.trim() || input.title)
  const isPublished = input.status === 'published'
  await db.insert(articles).values({
    title: input.title.trim(),
    slug,
    categoryId: input.categoryId ?? null,
    excerpt: input.excerpt ?? '',
    content: input.content ?? '',
    coverImage: input.coverImage ?? null,
    author: input.author ?? 'Редакция',
    tags: input.tags ?? [],
    status: input.status ?? 'draft',
    isFeatured: input.isFeatured ?? false,
    readingMinutes: input.readingMinutes ?? 1,
    metaTitle: input.metaTitle ?? null,
    metaDescription: input.metaDescription ?? null,
    publishedAt: isPublished ? new Date() : null,
  })
  revalidatePath('/admin/articles')
  return { success: true }
}

export async function updateArticle(id: number, input: ArticleInput) {
  await assertPermission('articles')
  const error = validate(input)
  if (error) return { success: false, error }
  const current = await getArticleById(id)
  if (!current) return { success: false, error: 'Статья не найдена' }
  const slug = await ensureSlug(input.slug?.trim() || input.title, id)
  const isPublished = input.status === 'published'
  await db
    .update(articles)
    .set({
      title: input.title.trim(),
      slug,
      categoryId: input.categoryId ?? null,
      excerpt: input.excerpt ?? '',
      content: input.content ?? '',
      coverImage: input.coverImage ?? null,
      author: input.author ?? 'Редакция',
      tags: input.tags ?? [],
      status: input.status ?? 'draft',
      isFeatured: input.isFeatured ?? false,
      readingMinutes: input.readingMinutes ?? 1,
      metaTitle: input.metaTitle ?? null,
      metaDescription: input.metaDescription ?? null,
      publishedAt: isPublished ? current.publishedAt ?? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(articles.id, id))
  revalidatePath('/admin/articles')
  return { success: true }
}

export async function toggleArticleStatus(id: number, status: 'draft' | 'published') {
  await assertPermission('articles')
  await db
    .update(articles)
    .set({ status, publishedAt: status === 'published' ? new Date() : null, updatedAt: new Date() })
    .where(eq(articles.id, id))
  revalidatePath('/admin/articles')
  return { success: true }
}

export async function toggleArticleFeatured(id: number, isFeatured: boolean) {
  await assertPermission('articles')
  await db.update(articles).set({ isFeatured, updatedAt: new Date() }).where(eq(articles.id, id))
  revalidatePath('/admin/articles')
  return { success: true }
}

export async function deleteArticle(id: number) {
  await assertPermission('articles')
  await db.delete(articles).where(eq(articles.id, id))
  revalidatePath('/admin/articles')
  return { success: true }
}

export async function createArticleCategory(name: string) {
  await assertPermission('articles')
  if (!name.trim()) return { success: false, error: 'Название обязательно' }
  await db.insert(articleCategories).values({ name: name.trim(), slug: slugify(name) || 'category' })
  revalidatePath('/admin/articles')
  return { success: true }
}
