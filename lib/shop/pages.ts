import 'server-only'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { pages } from '@/lib/db/schema'
import { pickLocalized, type Locale } from '@/lib/i18n/config'

/** Slugs shown as legal links in the footer, in display order. */
export const LEGAL_SLUGS = ['terms', 'privacy', 'returns', 'delivery'] as const

export async function getPublishedLegalPages(locale: Locale) {
  const rows = await db
    .select({
      slug: pages.slug,
      title: pages.title,
      titleRu: pages.titleRu,
    })
    .from(pages)
    .where(eq(pages.status, 'published'))
    .orderBy(asc(pages.sortOrder), asc(pages.id))

  return rows
    .filter((r) => (LEGAL_SLUGS as readonly string[]).includes(r.slug))
    .map((r) => ({ slug: r.slug, title: pickLocalized(locale, r.title, r.titleRu) }))
}

export async function getPageBySlug(slug: string, locale: Locale) {
  const [row] = await db.select().from(pages).where(eq(pages.slug, slug)).limit(1)
  if (!row || row.status !== 'published') return null
  return {
    slug: row.slug,
    title: pickLocalized(locale, row.title, row.titleRu),
    content: pickLocalized(locale, row.content, row.contentRu),
    updatedAt: row.updatedAt,
  }
}
