import { answerQuestion, deleteQuestion } from '@/app/actions/feedback'
import { ok, fail, readJson, parsePositiveInt } from '@/lib/api/helpers'
import { getAdminUserWithWritePermission } from '@/lib/session'
import { csrfCheck } from '@/lib/api/csrf'

type PatchBody = { answer?: string }

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // CSRF first (audit #5): a cross-site POST from an attacker's page runs
  // with the admin's cookies — refuse a foreign Origin before any auth or
  // DB work. No-Origin requests (non-browser clients) are allowed.
  const csrf = csrfCheck(req)
  if (csrf) return csrf
  if (!(await getAdminUserWithWritePermission('reviews'))) return fail('Не авторизовано', 403)
  const { id } = await params
  const idNum = parsePositiveInt(id)
  if (idNum == null) return fail('Некорректный id', 400)
  const body = await readJson<PatchBody>(req)
  if (!body || typeof body.answer !== 'string') return fail('Требуется поле answer')
  const result = await answerQuestion(idNum, body.answer)
  if (!result.success) return fail(result.error ?? 'Ошибка', 422)
  return ok({ answered: true })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // CSRF first (audit #5): a cross-site POST from an attacker's page runs
  // with the admin's cookies — refuse a foreign Origin before any auth or
  // DB work. No-Origin requests (non-browser clients) are allowed.
  const csrf = csrfCheck(req)
  if (csrf) return csrf
  if (!(await getAdminUserWithWritePermission('reviews'))) return fail('Не авторизовано', 403)
  const { id } = await params
  const idNum = parsePositiveInt(id)
  if (idNum == null) return fail('Некорректный id', 400)
  await deleteQuestion(idNum)
  return ok({ deleted: true })
}
