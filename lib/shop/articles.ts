import 'server-only'
import { and, desc, eq, ne, sql } from 'drizzle-orm'
import { db, pool } from '@/lib/db'
import { articles, articleCategories } from '@/lib/db/schema'
import { pickLocalized, type Locale } from '@/lib/i18n/config'

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

export async function getPublishedArticles(params: { categorySlug?: string; locale?: Locale } = {}): Promise<StorefrontArticleCard[]> {
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
      titleRu: articles.titleRu,
      slug: articles.slug,
      excerpt: articles.excerpt,
      excerptRu: articles.excerptRu,
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
  const locale = params.locale ?? 'uk'
  return rows.map((a) => ({
    id: a.id,
    title: pickLocalized(locale, a.title, a.titleRu),
    slug: a.slug,
    excerpt: pickLocalized(locale, a.excerpt, a.excerptRu) || a.excerpt,
    coverImage: a.coverImage,
    author: a.author,
    categoryId: a.categoryId,
    categoryName: a.categoryName,
    readingMinutes: a.readingMinutes,
    publishedAt: a.publishedAt,
    isFeatured: a.isFeatured,
  }))
}

export async function getArticleBySlug(slug: string, locale: Locale = 'uk') {
  const [row] = await db
    .select({
      id: articles.id,
      title: articles.title,
      titleRu: articles.titleRu,
      slug: articles.slug,
      excerpt: articles.excerpt,
      excerptRu: articles.excerptRu,
      content: articles.content,
      contentRu: articles.contentRu,
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

  return {
    ...row,
    title: pickLocalized(locale, row.title, row.titleRu),
    excerpt: pickLocalized(locale, row.excerpt, row.excerptRu) || row.excerpt,
    content: pickLocalized(locale, row.content, row.contentRu) || row.content,
  }
}

export async function getRelatedArticles(articleId: number, categoryId: number | null, limit = 3, locale: Locale = 'uk') {
  const conditions = [eq(articles.status, 'published'), ne(articles.id, articleId)]
  if (categoryId != null) conditions.push(eq(articles.categoryId, categoryId))
  const rows = await db
    .select({
      id: articles.id,
      title: articles.title,
      titleRu: articles.titleRu,
      slug: articles.slug,
      excerpt: articles.excerpt,
      excerptRu: articles.excerptRu,
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
  return rows.map((a) => ({
    id: a.id,
    title: pickLocalized(locale, a.title, a.titleRu),
    slug: a.slug,
    excerpt: pickLocalized(locale, a.excerpt, a.excerptRu) || a.excerpt,
    coverImage: a.coverImage,
    author: a.author,
    categoryId: a.categoryId,
    categoryName: a.categoryName,
    readingMinutes: a.readingMinutes,
    publishedAt: a.publishedAt,
    isFeatured: a.isFeatured,
  }))
}
