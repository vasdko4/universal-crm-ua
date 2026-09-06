import { getPublicPublishedPages, createPage, type PageInput } from '@/app/actions/pages'
import { ok, fail, parseListParams, readJson } from '@/lib/api/helpers'
import { getAdminUserWithPermission } from '@/lib/session'
import { localeFromRequest } from '@/lib/i18n/request-locale'
import { pickLocalized } from '@/lib/i18n/config'

export async function GET(req: Request) {
  const { page, pageSize, search, error } = parseListParams(req.url)
  if (error) return fail(error, 400)
  const locale = localeFromRequest(req)
  // Public, unauthenticated route. getPublicPublishedPages() always
  // queries published-only (getPages() now requires the 'pages' permission
  // and is not used here).
  const result = await getPublicPublishedPages({
    page,
    pageSize,
    search,
  })
  const items = result.items.map((p) => {
    const { titleRu, excerptRu, contentRu, ...rest } = p
    return {
      ...rest,
      title: pickLocalized(locale, p.title, titleRu),
      excerpt: pickLocalized(locale, p.excerpt, excerptRu) || p.excerpt,
      content: pickLocalized(locale, p.content, contentRu) || p.content,
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
  // Check auth here for a clean 403 — the action's own assertPermission()
  // would still block the write, but it throws (500 + noisy error log).
  if (!(await getAdminUserWithPermission('pages'))) return fail('Не авторизовано', 403)
  const body = await readJson<PageInput>(req)
  if (!body) return fail('Некорректный JSON')
  const result = await createPage(body)
  if (!result.success) return fail(result.error ?? 'Ошибка создания', 422)
  return ok({ created: true }, undefined)
}
