import { getPublicPublishedArticles, createArticle, type ArticleInput } from '@/app/actions/articles'
import { ok, fail, parseListParams, readJson } from '@/lib/api/helpers'
import { getAdminUserWithPermission } from '@/lib/session'

export async function GET(req: Request) {
  const { page, pageSize, search, searchParams } = parseListParams(req.url)
  const catParam = searchParams.get('categoryId')
  let categoryId: number | 'all' = 'all'
  if (catParam != null && catParam !== '') {
    if (!/^\d+$/.test(catParam)) return fail('Некорректный categoryId', 400)
    categoryId = Number(catParam)
  }
  // Public, unauthenticated route. getPublicPublishedArticles() always
  // queries published-only (getArticles() now requires the 'articles'
  // permission and is not used here).
  const result = await getPublicPublishedArticles({
    page,
    pageSize,
    search,
    categoryId,
  })
  return ok(result.items, {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
  })
}

export async function POST(req: Request) {
  // Check auth here for a clean 403 — the action's own assertPermission()
  // would still block the write, but it throws (500 + noisy error log).
  if (!(await getAdminUserWithPermission('articles'))) return fail('Не авторизовано', 403)
  const body = await readJson<ArticleInput>(req)
  if (!body) return fail('Некорректный JSON')
  const result = await createArticle(body)
  if (!result.success) return fail(result.error ?? 'Ошибка создания', 422)
  return ok({ created: true })
}
