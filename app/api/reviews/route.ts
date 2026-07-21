import { getPublicApprovedReviews, createReview } from '@/app/actions/feedback'
import { ok, fail, parseListParams, readJson } from '@/lib/api/helpers'
import { isRateLimited, clientIp } from '@/lib/api/rate-limit'

export async function GET(req: Request) {
  const { page, pageSize } = parseListParams(req.url)
  // Public, unauthenticated route. getPublicApprovedReviews() is a dedicated
  // function that always queries approved-only and never selects the
  // reviewer's email column at all (getReviews() now requires the 'reviews'
  // permission and is not used here, so a direct call to it can never
  // accidentally leak pending/rejected reviews or emails to this route).
  const result = await getPublicApprovedReviews({ page, pageSize })
  return ok(result.items, {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
  })
}

export async function POST(req: Request) {
  // Public, unauthenticated write — rate-limit per IP to stop spam floods.
  if (isRateLimited('reviews', clientIp(req), 5)) {
    return fail('Слишком много запросов, попробуйте позже', 429)
  }
  const body = await readJson<Parameters<typeof createReview>[0]>(req)
  if (!body) return fail('Некорректный JSON')
  const result = await createReview(body)
  if (!result.success) return fail(result.error ?? 'Ошибка создания', 422)
  return ok({ created: true })
}
