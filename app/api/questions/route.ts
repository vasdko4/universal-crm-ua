import { getPublicAnsweredQuestions, createQuestion } from '@/app/actions/feedback'
import { ok, fail, parseListParams, readJson } from '@/lib/api/helpers'
import { isRateLimited, clientIp } from '@/lib/api/rate-limit'

export async function GET(req: Request) {
  const { page, pageSize } = parseListParams(req.url)
  // Public, unauthenticated route. getPublicAnsweredQuestions() is a
  // dedicated function that always queries answered-only and never selects
  // the asker's email column at all (getQuestions() now requires the
  // 'reviews' permission and is not used here, so a direct call to it can
  // never accidentally leak pending questions or emails to this route).
  const result = await getPublicAnsweredQuestions({ page, pageSize })
  return ok(result.items, {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
  })
}

export async function POST(req: Request) {
  // Public, unauthenticated write — rate-limit per IP to stop spam floods.
  if (isRateLimited('questions', clientIp(req), 5)) {
    return fail('Слишком много запросов, попробуйте позже', 429)
  }
  const body = await readJson<Parameters<typeof createQuestion>[0]>(req)
  if (!body) return fail('Некорректный JSON')
  const result = await createQuestion(body)
  if (!result.success) return fail(result.error ?? 'Ошибка создания', 422)
  return ok({ created: true })
}
