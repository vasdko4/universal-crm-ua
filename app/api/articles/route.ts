import { getPublicPublishedArticles, createArticle, type ArticleInput } from '@/app/actions/articles'
import { ok, fail, parseListParams, readJson } from '@/lib/api/helpers'
import { getAdminUserWithPermission } from '@/lib/session'
import { localeFromRequest } from '@/lib/i18n/request-locale'
import { pickLocalized } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'

export async function GET(req: Request) {
  const { page, pageSize, search, searchParams, error } = parseListParams(req.url)
  if (error) return fail(error, 400)
  const catParam = searchParams.get('categoryId')
  let categoryId: number | 'all' = 'all'
  if (catParam != null && catParam !== '') {
    if (!/^\d+$/.test(catParam)) return fail('Некорректный categoryId', 400)
    categoryId = Number(catParam)
  }
  const locale = localeFromRequest(req)
  const dict = getDictionary(locale)
  const result = await getPublicPublishedArticles({
    page,
    pageSize,
    search,
    categoryId,
  })
  const items = result.items.map((a) => {
    const { titleRu, excerptRu, contentRu, ...rest } = a
    return {
      ...rest,
      title: pickLocalized(locale, a.title, titleRu),
      excerpt: pickLocalized(locale, a.excerpt, excerptRu) || a.excerpt,
      content: pickLocalized(locale, a.content, contentRu) || a.content,
      categoryName: a.categorySlug
        ? (dict.articles.categoryNames[a.categorySlug] ?? a.categoryName)
        : a.categoryName,
    }
  })
  return ok(items, {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
    locale,
  })
}

export async function POST(req: Request) {
  if (!(await getAdminUserWithPermission('articles'))) return fail('Не авторизовано', 403)
  const body = await readJson<ArticleInput>(req)
  if (!body) return fail('Некорректный JSON')
  const result = await createArticle(body)
  if (!result.success) return fail(result.error ?? 'Ошибка создания', 422)
  return ok({ created: true })
}
