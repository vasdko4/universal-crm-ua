import { getPublicAnsweredQuestions, createQuestion } from '@/app/actions/feedback'
import { ok, fail, parseListParams, readJson, parsePositiveInt } from '@/lib/api/helpers'
import { isRateLimited, clientIp } from '@/lib/api/rate-limit'
import { csrfCheck } from '@/lib/api/csrf'

export async function GET(req: Request) {
  const { page, pageSize, searchParams, error } = parseListParams(req.url)
  if (error) return fail(error, 400)
  const rawId = searchParams.get('productId')
  let productId: number | undefined
  if (rawId != null && rawId !== '') {
    const parsed = parsePositiveInt(rawId)
    if (parsed == null) return fail('Некорректный productId', 400)
    productId = parsed
  }
  const result = await getPublicAnsweredQuestions({ page, pageSize, productId })
  return ok(result.items, {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
  })
}

export async function POST(req: Request) {
  // CSRF first (audit #5): a cross-site POST from an attacker's page runs
  // with the admin's cookies — refuse a foreign Origin before any auth or
  // DB work. No-Origin requests (non-browser clients) are allowed.
  const csrf = csrfCheck(req)
  if (csrf) return csrf
  if (await isRateLimited('questions', clientIp(req), 5)) {
    return fail('Слишком много запросов, попробуйте позже', 429)
  }
  const body = await readJson<Parameters<typeof createQuestion>[0]>(req)
  if (!body) return fail('Некорректный JSON')
  const result = await createQuestion(body)
  if (!result.success) return fail(result.error ?? 'Ошибка создания', 422)
  return ok({ created: true })
}
