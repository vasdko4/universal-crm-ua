import { getPublicPublishedPageById, updatePage, deletePage, type PageInput } from '@/app/actions/pages'
import { ok, fail, readJson } from '@/lib/api/helpers'
import { getAdminUserWithPermission } from '@/lib/session'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Public, unauthenticated route. getPublicPublishedPageById() always
  // queries published-only (getPageById() now requires the 'pages'
  // permission and is not used here).
  const row = await getPublicPublishedPageById(Number(id))
  if (!row) return fail('Страница не найдена', 404)
  return ok(row)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Check auth here for a clean 403 — the action's own assertPermission()
  // would still block the write, but it throws (500 + noisy error log).
  if (!(await getAdminUserWithPermission('pages'))) return fail('Не авторизовано', 403)
  const { id } = await params
  const body = await readJson<PageInput>(req)
  if (!body) return fail('Некорректный JSON')
  const result = await updatePage(Number(id), body)
  if (!result.success) return fail(result.error ?? 'Ошибка обновления', 422)
  return ok({ updated: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Check auth here for a clean 403 — the action's own assertPermission()
  // would still block the write, but it throws (500 + noisy error log).
  if (!(await getAdminUserWithPermission('pages'))) return fail('Не авторизовано', 403)
  const { id } = await params
  await deletePage(Number(id))
  return ok({ deleted: true })
}
