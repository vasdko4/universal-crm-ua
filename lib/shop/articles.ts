import 'server-only'
import { and, desc, eq, ne, sql } from 'drizzle-orm'
import { db, pool } from '@/lib/db'
import { articles, articleCategories } from '@/lib/db/schema'

export type StorefrontArticleCard = {
  id: number
  title: string
  slug: string
  excerpt: string | null
  coverImage: string | null
  author: string | null
  categoryId: number | null
  categoryName: string | null
  readingMinutes: number
  publishedAt: Date | null
  isFeatured: boolean
}

export type StorefrontArticleCategory = { id: number; name: string; slug: string; count: number }

// Categories that have at least one published article, with counts.
export async function getPublishedArticleCategories(): Promise<StorefrontArticleCategory[]> {
  const rows = await db
    .select({
      id: articleCategories.id,
      name: articleCategories.name,
      slug: articleCategories.slug,
      count: sql<number>`count(${articles.id})::int`,
    })
    .from(articleCategories)
    .innerJoin(articles, and(eq(articles.categoryId, articleCategories.id), eq(articles.status, 'published')))
    .groupBy(articleCategories.id, articleCategories.name, articleCategories.slug)
    .orderBy(articleCategories.sortOrder, articleCategories.id)
  return rows
}

export async function getPublishedArticles(params: { categorySlug?: string } = {}): Promise<StorefrontArticleCard[]> {
  const conditions = [eq(articles.status, 'published')]
  if (params.categorySlug) {
    const [cat] = await db
      .select({ id: articleCategories.id })
      .from(articleCategories)
      .where(eq(articleCategories.slug, params.categorySlug))
      .limit(1)
    if (!cat) return []
    conditions.push(eq(articles.categoryId, cat.id))
  }

  const rows = await db
    .select({
      id: articles.id,
      title: articles.title,
      slug: articles.slug,
      excerpt: articles.excerpt,
      coverImage: articles.coverImage,
      author: articles.author,
      categoryId: articles.categoryId,
      categoryName: articleCategories.name,
      readingMinutes: articles.readingMinutes,
      publishedAt: articles.publishedAt,
      isFeatured: articles.isFeatured,
    })
    .from(articles)
    .leftJoin(articleCategories, eq(articles.categoryId, articleCategories.id))
    .where(and(...conditions))
    .orderBy(desc(articles.isFeatured), desc(articles.publishedAt), desc(articles.createdAt))
  return rows
}

export async function getArticleBySlug(slug: string) {
  const [row] = await db
    .select({
      id: articles.id,
      title: articles.title,
      slug: articles.slug,
      excerpt: articles.excerpt,
      content: articles.content,
      coverImage: articles.coverImage,
      author: articles.author,
      tags: articles.tags,
      categoryId: articles.categoryId,
      categoryName: articleCategories.name,
      categorySlug: articleCategories.slug,
      readingMinutes: articles.readingMinutes,
      viewsCount: articles.viewsCount,
      metaTitle: articles.metaTitle,
      metaDescription: articles.metaDescription,
      publishedAt: articles.publishedAt,
    })
    .from(articles)
    .leftJoin(articleCategories, eq(articles.categoryId, articleCategories.id))
    .where(and(eq(articles.slug, slug), eq(articles.status, 'published')))
    .limit(1)
  if (!row) return null

  // Fire-and-forget view counter; never block rendering on it.
  pool.query(`UPDATE articles SET views_count = views_count + 1 WHERE id = $1`, [row.id]).catch(() => {})

  return row
}

export async function getRelatedArticles(articleId: number, categoryId: number | null, limit = 3) {
  const conditions = [eq(articles.status, 'published'), ne(articles.id, articleId)]
  if (categoryId != null) conditions.push(eq(articles.categoryId, categoryId))
  const rows = await db
    .select({
      id: articles.id,
      title: articles.title,
      slug: articles.slug,
      excerpt: articles.excerpt,
      coverImage: articles.coverImage,
      author: articles.author,
      categoryId: articles.categoryId,
      categoryName: articleCategories.name,
      readingMinutes: articles.readingMinutes,
      publishedAt: articles.publishedAt,
      isFeatured: articles.isFeatured,
    })
    .from(articles)
    .leftJoin(articleCategories, eq(articles.categoryId, articleCategories.id))
    .where(and(...conditions))
    .orderBy(desc(articles.publishedAt))
    .limit(limit)
  return rows
}
