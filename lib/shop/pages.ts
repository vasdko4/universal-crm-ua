import 'server-only'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { pages } from '@/lib/db/schema'
import { pickLocalized, type Locale } from '@/lib/i18n/config'

/** Slugs shown as legal links in the footer, in display order. */
export const LEGAL_SLUGS = ['terms', 'privacy', 'returns', 'delivery'] as const

/**
 * RU copy for the Techno Store demo pages that were seeded without title_ru /
 * content_ru. Only applied when the stored UK body still matches the seed, so
 * a merchant who rewrote those pages is never overwritten.
 */
const DEMO_RU_PAGES: Record<string, { titleUk: string; contentNeedle: string; titleRu: string; contentRu: string }> = {
  about: {
    titleUk: 'О компании',
    contentNeedle: 'Ми продаємо якісну електроніку з 2015 року',
    titleRu: 'О компании',
    contentRu: '<h2>О нашем магазине</h2><p>Мы продаём качественную электронику с 2015 года.</p>',
  },
  'delivery-payment': {
    titleUk: 'Доставка и оплата',
    contentNeedle: 'Доставляємо Новою Поштою та Укрпоштою',
    titleRu: 'Доставка и оплата',
    contentRu: '<h2>Условия доставки</h2><p>Доставляем Новой Почтой и Укрпочтой по всей Украине.</p>',
  },
  contacts: {
    titleUk: 'Контакты',
    contentNeedle: 'Наші контакти',
    titleRu: 'Контакты',
    contentRu: '<h2>Наши контакты</h2><p>Телефон: +380 44 123 45 67</p>',
  },
}

function demoRu(slug: string, title: string | null | undefined, content: string | null | undefined) {
  const demo = DEMO_RU_PAGES[slug]
  if (!demo) return null
  if ((title ?? '') !== demo.titleUk) return null
  if (!(content ?? '').includes(demo.contentNeedle)) return null
  return demo
}

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
  const demo = demoRu(row.slug, row.title, row.content)
  const titleRu = row.titleRu || demo?.titleRu || null
  const contentRu = row.contentRu || demo?.contentRu || null
  return {
    slug: row.slug,
    title: pickLocalized(locale, row.title, titleRu),
    content: pickLocalized(locale, row.content, contentRu),
    updatedAt: row.updatedAt,
  }
}
