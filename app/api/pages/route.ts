import { getPublicPublishedPages, createPage, type PageInput } from '@/app/actions/pages'
import { ok, fail, parseListParams, readJson } from '@/lib/api/helpers'

export async function GET(req: Request) {
  const { page, pageSize, search } = parseListParams(req.url)
  // Public, unauthenticated route. getPublicPublishedPages() always
  // queries published-only (getPages() now requires the 'pages' permission
  // and is not used here).
  const result = await getPublicPublishedPages({
    page,
    pageSize,
    search,
  })
  return ok(result.items, {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
  })
}

export async function POST(req: Request) {
  const body = await readJson<PageInput>(req)
  if (!body) return fail('Некорректный JSON')
  const result = await createPage(body)
  if (!result.success) return fail(result.error ?? 'Ошибка создания', 422)
  return ok({ created: true }, undefined)
}
