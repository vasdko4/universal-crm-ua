import { submitQuestion } from '@/app/actions/shop'
import { getPublicAnsweredQuestions } from '@/app/actions/feedback'
import { fail, ok, parsePositiveInt, readJson } from '@/lib/api/helpers'
import { clientIp, isRateLimited } from '@/lib/api/rate-limit'
import { getProductBySlug } from '@/lib/shop/queries'
import { sanitizeContent } from '@/lib/shop/sanitize'

const NOT_FOUND = 'Товар не знайдено'
const DEFAULT_PER_PAGE = 20
const MAX_PER_PAGE = 100
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Public product Q&A for the store REST API v1 (Android shop app).
 *
 * GET /api/v1/products/[slug]/questions?page=&perPage=
 * - Answered questions only (the same public surface as /api/questions) —
 *   never includes the asker's email. page: positive int, default 1.
 *   perPage: positive int, default 20, max 100. Unknown slug -> 404.
 *
 * POST /api/v1/products/[slug]/questions
 * Body: { authorName, text, email? }
 * - authorName: non-empty, capped at 120 chars. text: non-empty, sanitized
 *   with the repo's sanitizeContent (strips scripts/event handlers) and
 *   capped at 3000 chars. email: validated format when present, capped
 *   at 255 chars. The question goes to moderation (status 'pending') —
 *   the response says so. Unknown slug -> 404.
 * - submitQuestion has its own per-IP limiter (5/min, scope 'questions');
 *   the route adds the same 5/min on top.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (await isRateLimited('api-v1-questions', clientIp(request), 60)) {
    return fail('Забагато запитів, спробуйте пізніше', 429)
  }
  const { slug } = await params
  const resolved = await getProductBySlug(slug)
  if (!resolved) return fail(NOT_FOUND, 404)
  const productId = resolved.product.id

  const { searchParams } = new URL(request.url)
  const pageRaw = searchParams.get('page')
  let page = 1
  if (pageRaw != null && pageRaw !== '') {
    const parsed = parsePositiveInt(pageRaw)
    if (parsed == null) return fail('Некорректный page', 400)
    page = parsed
  }
  const perPageRaw = searchParams.get('perPage')
  let perPage = DEFAULT_PER_PAGE
  if (perPageRaw != null && perPageRaw !== '') {
    const parsed = parsePositiveInt(perPageRaw)
    if (parsed == null || parsed > MAX_PER_PAGE) return fail('Некорректный perPage', 400)
    perPage = parsed
  }

  const { items, total, page: effPage, pageSize, totalPages } = await getPublicAnsweredQuestions({
    productId,
    page,
    pageSize: perPage,
  })
  return ok({
    items: items.map((q) => ({
      id: q.id,
      authorName: q.authorName,
      question: q.question,
      answer: q.answer,
      answeredAt: q.answeredAt ? q.answeredAt.toISOString() : null,
      createdAt: q.createdAt ? q.createdAt.toISOString() : null,
    })),
    total,
    page: effPage,
    perPage: pageSize,
    totalPages,
  })
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (await isRateLimited('api-v1-questions-post', clientIp(request), 5)) {
    return fail('Забагато запитів, спробуйте пізніше', 429)
  }
  const { slug } = await params
  const resolved = await getProductBySlug(slug)
  if (!resolved) return fail(NOT_FOUND, 404)
  const productId = resolved.product.id

  const body = await readJson<Record<string, unknown>>(request)
  if (!body || typeof body !== 'object') return fail('Некорректный JSON', 400)

  const authorName = typeof body.authorName === 'string' ? body.authorName.trim().slice(0, 120) : ''
  if (!authorName) return fail("Ім'я обов'язкове", 400)

  const rawText = typeof body.text === 'string' ? body.text : ''
  const text = sanitizeContent(rawText).trim().slice(0, 3000)
  // Markup-only input ('<b></b>') survives the sanitizer as-is — reject it
  // when it carries no visible text. The regex is only the emptiness check;
  // the stored text keeps the sanitized HTML.
  const visibleText = text.replace(/<[^>]*>/g, '').trim()
  if (!visibleText) return fail('Текст питання обовʼязковий', 400)

  let authorEmail: string | undefined
  if (body.email != null && body.email !== '') {
    if (typeof body.email !== 'string') return fail('Некорректный email', 400)
    const email = body.email.trim().slice(0, 255)
    if (!EMAIL_RE.test(email)) return fail('Некорректный email', 400)
    authorEmail = email
  }

  const res = await submitQuestion({
    productId,
    question: text,
    authorName,
    authorEmail,
  })
  // submitQuestion's inferred union does not narrow cleanly (the same
  // inference quirk as the checkout route's result type), so guard the
  // error access instead of relying on discriminant narrowing.
  if (!res.success) return fail(res.error ?? 'Помилка', 400)
  return ok({ status: 'pending' })
}
