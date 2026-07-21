import { answerQuestion, deleteQuestion } from '@/app/actions/feedback'
import { ok, fail, readJson } from '@/lib/api/helpers'

type PatchBody = { answer?: string }

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await readJson<PatchBody>(req)
  if (!body || typeof body.answer !== 'string') return fail('Требуется поле answer')
  const result = await answerQuestion(Number(id), body.answer)
  if (!result.success) return fail(result.error ?? 'Ошибка', 422)
  return ok({ answered: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await deleteQuestion(Number(id))
  return ok({ deleted: true })
}
