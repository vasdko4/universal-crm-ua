import { getPublicPublishedPageById, updatePage, deletePage, type PageInput } from '@/app/actions/pages'
import { ok, fail, readJson, parsePositiveInt } from '@/lib/api/helpers'
import { getAdminUserWithWritePermission } from '@/lib/session'
import { csrfCheck } from '@/lib/api/csrf'
import { localeFromRequest } from '@/lib/i18n/request-locale'
import { pickLocalized } from '@/lib/i18n/config'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const idNum = parsePositiveInt(id)
  if (idNum == null) return fail('Некорректный id', 400)
  const row = await getPublicPublishedPageById(idNum)
  if (!row) return fail('Страница не найдена', 404)
  const locale = localeFromRequest(req)
  const { titleRu, excerptRu, contentRu, ...rest } = row
  return ok({
    ...rest,
    title: pickLocalized(locale, row.title, titleRu),
    excerpt: pickLocalized(locale, row.excerpt, excerptRu) || row.excerpt,
    content: pickLocalized(locale, row.content, contentRu) || row.content,
  }, { locale })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // CSRF first (audit #5): a cross-site POST from an attacker's page runs
  // with the admin's cookies — refuse a foreign Origin before any auth or
  // DB work. No-Origin requests (non-browser clients) are allowed.
  const csrf = csrfCheck(req)
  if (csrf) return csrf
  if (!(await getAdminUserWithWritePermission('pages'))) return fail('Не авторизовано', 403)
  const { id } = await params
  const idNum = parsePositiveInt(id)
  if (idNum == null) return fail('Некорректный id', 400)
  const body = await readJson<PageInput>(req)
  if (!body) return fail('Некорректный JSON')
  const result = await updatePage(idNum, body)
  if (!result.success) return fail(result.error ?? 'Ошибка обновления', 422)
  return ok({ updated: true })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // CSRF first (audit #5): a cross-site POST from an attacker's page runs
  // with the admin's cookies — refuse a foreign Origin before any auth or
  // DB work. No-Origin requests (non-browser clients) are allowed.
  const csrf = csrfCheck(req)
  if (csrf) return csrf
  if (!(await getAdminUserWithWritePermission('pages'))) return fail('Не авторизовано', 403)
  const { id } = await params
  const idNum = parsePositiveInt(id)
  if (idNum == null) return fail('Некорректный id', 400)
  await deletePage(idNum)
  return ok({ deleted: true })
}
