import { getPublicPublishedPages, createPage, type PageInput } from '@/app/actions/pages'
import { ok, fail, parseListParams, readJson } from '@/lib/api/helpers'
import { getAdminUserWithPermission } from '@/lib/session'

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
  // Check auth here for a clean 403 — the action's own assertPermission()
  // would still block the write, but it throws (500 + noisy error log).
  if (!(await getAdminUserWithPermission('pages'))) return fail('Не авторизовано', 403)
  const body = await readJson<PageInput>(req)
  if (!body) return fail('Некорректный JSON')
  const result = await createPage(body)
  if (!result.success) return fail(result.error ?? 'Ошибка создания', 422)
  return ok({ created: true }, undefined)
}
