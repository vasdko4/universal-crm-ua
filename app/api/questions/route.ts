import { getPublicAnsweredQuestions, createQuestion } from '@/app/actions/feedback'
import { ok, fail, parseListParams, readJson, parsePositiveInt } from '@/lib/api/helpers'
import { isRateLimited, clientIp } from '@/lib/api/rate-limit'

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
  if (isRateLimited('questions', clientIp(req), 5)) {
    return fail('Слишком много запросов, попробуйте позже', 429)
  }
  const body = await readJson<Parameters<typeof createQuestion>[0]>(req)
  if (!body) return fail('Некорректный JSON')
  const result = await createQuestion(body)
  if (!result.success) return fail(result.error ?? 'Ошибка создания', 422)
  return ok({ created: true })
}
