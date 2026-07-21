import { getPublicPublishedArticles, createArticle, type ArticleInput } from '@/app/actions/articles'
import { ok, fail, parseListParams, readJson } from '@/lib/api/helpers'

export async function GET(req: Request) {
  const { page, pageSize, search, searchParams } = parseListParams(req.url)
  const catParam = searchParams.get('categoryId')
  // Public, unauthenticated route. getPublicPublishedArticles() always
  // queries published-only (getArticles() now requires the 'articles'
  // permission and is not used here).
  const result = await getPublicPublishedArticles({
    page,
    pageSize,
    search,
    categoryId: catParam ? Number(catParam) : 'all',
  })
  return ok(result.items, {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
  })
}

export async function POST(req: Request) {
  const body = await readJson<ArticleInput>(req)
  if (!body) return fail('Некорректный JSON')
  const result = await createArticle(body)
  if (!result.success) return fail(result.error ?? 'Ошибка создания', 422)
  return ok({ created: true })
}
