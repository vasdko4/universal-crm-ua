import { setReviewStatus, replyToReview, deleteReview } from '@/app/actions/feedback'
import { ok, fail, readJson, parsePositiveInt } from '@/lib/api/helpers'
import { getAdminUserWithPermission } from '@/lib/session'

type PatchBody = { status?: 'pending' | 'approved' | 'rejected'; reply?: string }

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminUserWithPermission('reviews'))) return fail('Не авторизовано', 403)
  const { id } = await params
  const idNum = parsePositiveInt(id)
  if (idNum == null) return fail('Некорректный id', 400)
  const body = await readJson<PatchBody>(req)
  if (!body) return fail('Некорректный JSON')
  if (body.status) await setReviewStatus(idNum, body.status)
  if (typeof body.reply === 'string') await replyToReview(idNum, body.reply)
  return ok({ updated: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminUserWithPermission('reviews'))) return fail('Не авторизовано', 403)
  const { id } = await params
  const idNum = parsePositiveInt(id)
  if (idNum == null) return fail('Некорректный id', 400)
  await deleteReview(idNum)
  return ok({ deleted: true })
}
