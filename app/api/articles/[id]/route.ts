import { getPublicPublishedArticleById, updateArticle, deleteArticle, type ArticleInput } from '@/app/actions/articles'
import { ok, fail, readJson } from '@/lib/api/helpers'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Public, unauthenticated route. getPublicPublishedArticleById() always
  // queries published-only (getArticleById() now requires the 'articles'
  // permission and is not used here).
  const row = await getPublicPublishedArticleById(Number(id))
  if (!row) return fail('Статья не найдена', 404)
  return ok(row)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await readJson<ArticleInput>(req)
  if (!body) return fail('Некорректный JSON')
  const result = await updateArticle(Number(id), body)
  if (!result.success) return fail(result.error ?? 'Ошибка обновления', 422)
  return ok({ updated: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await deleteArticle(Number(id))
  return ok({ deleted: true })
}
