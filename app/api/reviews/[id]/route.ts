import { setReviewStatus, replyToReview, deleteReview } from '@/app/actions/feedback'
import { ok, fail, readJson } from '@/lib/api/helpers'

type PatchBody = { status?: 'pending' | 'approved' | 'rejected'; reply?: string }

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await readJson<PatchBody>(req)
  if (!body) return fail('Некорректный JSON')
  if (body.status) await setReviewStatus(Number(id), body.status)
  if (typeof body.reply === 'string') await replyToReview(Number(id), body.reply)
  return ok({ updated: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await deleteReview(Number(id))
  return ok({ deleted: true })
}
