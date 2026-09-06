import { getPublicApprovedReviews, createReview } from '@/app/actions/feedback'
import { ok, fail, parseListParams, readJson, parsePositiveInt } from '@/lib/api/helpers'
import { isRateLimited, clientIp } from '@/lib/api/rate-limit'

export async function GET(req: Request) {
  const { page, pageSize, searchParams } = parseListParams(req.url)
  const rawId = searchParams.get('productId')
  let productId: number | undefined
  if (rawId != null && rawId !== '') {
    const parsed = parsePositiveInt(rawId)
    if (parsed == null) return fail('Некорректный productId', 400)
    productId = parsed
  }
  const result = await getPublicApprovedReviews({ page, pageSize, productId })
  return ok(result.items, {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
  })
}

export async function POST(req: Request) {
  if (isRateLimited('reviews', clientIp(req), 5)) {
    return fail('Слишком много запросов, попробуйте позже', 429)
  }
  const body = await readJson<Parameters<typeof createReview>[0]>(req)
  if (!body) return fail('Некорректный JSON')
  const result = await createReview(body)
  if (!result.success) return fail(result.error ?? 'Ошибка создания', 422)
  return ok({ created: true })
}
