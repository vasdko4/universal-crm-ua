import { getPublicPublishedArticleById, updateArticle, deleteArticle, type ArticleInput } from '@/app/actions/articles'
import { ok, fail, readJson, parsePositiveInt } from '@/lib/api/helpers'
import { getAdminUserWithPermission } from '@/lib/session'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const idNum = parsePositiveInt(id)
  if (idNum == null) return fail('Некорректный id', 400)
  const row = await getPublicPublishedArticleById(idNum)
  if (!row) return fail('Статья не найдена', 404)
  return ok(row)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminUserWithPermission('articles'))) return fail('Не авторизовано', 403)
  const { id } = await params
  const idNum = parsePositiveInt(id)
  if (idNum == null) return fail('Некорректный id', 400)
  const body = await readJson<ArticleInput>(req)
  if (!body) return fail('Некорректный JSON')
  const result = await updateArticle(idNum, body)
  if (!result.success) return fail(result.error ?? 'Ошибка обновления', 422)
  return ok({ updated: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminUserWithPermission('articles'))) return fail('Не авторизовано', 403)
  const { id } = await params
  const idNum = parsePositiveInt(id)
  if (idNum == null) return fail('Некорректный id', 400)
  await deleteArticle(idNum)
  return ok({ deleted: true })
}
