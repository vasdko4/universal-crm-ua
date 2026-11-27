import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { stripToPlainText } from '@/lib/shop/sanitize'

const root = resolve(import.meta.dirname, '..')
const source = (file: string) => readFileSync(resolve(root, file), 'utf8').replace(/\r\n/g, '\n')

// 3.4.109 #7: v1 review/question text is stored as PLAIN TEXT, not
// sanitized HTML. The routes keep a LOCAL stripToPlainText (a test asserts
// `allowedTags: []` in the route source); the server-action delegates share
// the one in lib/shop/sanitize.ts.

describe('stripToPlainText (lib/shop/sanitize, shared by the delegates)', () => {
  it('strips tags and drops script content', () => {
    expect(stripToPlainText('<script>alert(1)</script>Чудово <b>все</b>')).toBe('Чудово все')
  })

  it('drops event-handler attributes with their tag', () => {
    expect(stripToPlainText('<img src=x onerror=alert(1)>hi')).toBe('hi')
  })

  it('decodes entities a single pass: &lt;b&gt; stays inert text, never a tag', () => {
    const out = stripToPlainText('a &lt;b&gt; c')
    expect(out).not.toContain('<b>')
    expect(out).toContain('a')
    expect(out).toContain('c')
  })

  it('keeps a literal ampersand as text', () => {
    expect(stripToPlainText('a &amp; b')).toBe('a &amp; b')
  })

  it('markup-only input strips to empty', () => {
    expect(stripToPlainText('<b></b>')).toBe('')
  })

  it('trims surrounding whitespace', () => {
    expect(stripToPlainText('  spaced  ')).toBe('spaced')
  })
})

describe('v1 routes keep a LOCAL stripToPlainText (source)', () => {
  it('reviews route: local stripToPlainText, no sanitizeContent, no order lookup', () => {
    const src = source('app/api/v1/products/[slug]/reviews/route.ts')
    expect(src).toContain('function stripToPlainText')
    expect(src).toContain('allowedTags: []')
    expect(src).not.toContain('sanitizeContent')
    expect(src).not.toContain("from '@/lib/db'")
    expect(src).not.toContain('eq(orders.orderNumber')
    expect(src).not.toContain('Замовлення не знайдено')
  })

  it('questions route: local stripToPlainText, no sanitizeContent', () => {
    const src = source('app/api/v1/products/[slug]/questions/route.ts')
    expect(src).toContain('function stripToPlainText')
    expect(src).toContain('allowedTags: []')
    expect(src).not.toContain('sanitizeContent')
  })

  it('routes do NOT import the shared helper (local copy is deliberate)', () => {
    for (const file of [
      'app/api/v1/products/[slug]/reviews/route.ts',
      'app/api/v1/products/[slug]/questions/route.ts',
    ]) {
      expect(source(file)).not.toContain('stripToPlainText } from')
    }
  })
})

describe('shared delegates store plain text (source)', () => {
  it('shop.ts submitReview/submitQuestion use the shared stripToPlainText', () => {
    const src = source('app/actions/shop.ts')
    // shop.ts also imports parseStrictRating + safeTextField from the same
    // module (3.4.109 build fix: 'use server' forbids non-async exports, so
    // the helpers live in lib/shop/sanitize.ts, not in the actions file).
    expect(src).toContain("import { stripToPlainText, parseStrictRating, safeTextField } from '@/lib/shop/sanitize'")
    const reviewAt = src.indexOf('export async function submitReview(')
    const questionAt = src.indexOf('export async function submitQuestion(')
    expect(src.slice(reviewAt, questionAt)).toContain('stripToPlainText(')
    expect(src.slice(questionAt)).toContain('stripToPlainText(')
  })

  it('feedback.ts createReview/createQuestion use the shared stripToPlainText', () => {
    const src = source('app/actions/feedback.ts')
    expect(src).toContain("import { stripToPlainText } from '@/lib/shop/sanitize'")
    const reviewAt = src.indexOf('export async function createReview(')
    const questionAt = src.indexOf('export async function createQuestion(')
    expect(src.slice(reviewAt, questionAt)).toContain('stripToPlainText(')
    expect(src.slice(questionAt)).toContain('stripToPlainText(')
  })

  it('admin replies/answers are left alone (trusted admin, separate columns)', () => {
    const src = source('app/actions/feedback.ts')
    expect(src).toContain('adminReply: reply')
    expect(src).toContain('answer: answer.trim()')
    // Slice each admin function only up to the NEXT exported function —
    // replyToReview sits before createQuestion in file order, so a naive
    // slice to answerQuestion would wrongly include it.
    const section = (name: string) => {
      const start = src.indexOf(`export async function ${name}(`)
      const next = src.indexOf('export async function ', start + 10)
      return next === -1 ? src.slice(start) : src.slice(start, next)
    }
    expect(section('replyToReview')).not.toContain('stripToPlainText')
    expect(section('answerQuestion')).not.toContain('stripToPlainText')
  })
})

// --- Route behaviour with mocked delegates/queries (mirrors the
// api-v1-extras.test.ts mock setup) ---

const mocks = vi.hoisted(() => ({
  limited: false,
  product: null as { product: { id: number; slug: string } } | null,
  reviewResult: { success: true } as unknown,
  questionResult: { success: true } as unknown,
  approvedReviews: [] as { authorName: string; rating: number; body: string; createdAt: Date | null }[],
  questionsList: {
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  } as unknown,
}))

vi.mock('@/lib/api/rate-limit', () => ({
  clientIp: vi.fn(() => '1.2.3.4'),
  isRateLimited: vi.fn(async () => mocks.limited),
}))
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) =>
      Response.json(body as Record<string, unknown>, init),
  },
}))
vi.mock('@/app/actions/shop', () => ({
  submitReview: vi.fn(async () => mocks.reviewResult),
  submitQuestion: vi.fn(async () => mocks.questionResult),
}))
vi.mock('@/app/actions/feedback', () => ({
  getPublicAnsweredQuestions: vi.fn(async () => mocks.questionsList),
}))
vi.mock('@/lib/shop/queries', () => ({
  getProductBySlug: vi.fn(async () => mocks.product),
  getApprovedReviews: vi.fn(async () => mocks.approvedReviews),
}))

import { GET as getReviews, POST as postReview } from '@/app/api/v1/products/[slug]/reviews/route'
import { POST as postQuestion } from '@/app/api/v1/products/[slug]/questions/route'
import { submitReview, submitQuestion } from '@/app/actions/shop'

function postJson(url: string, body: unknown) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as never
}

async function json(res: Response) {
  return (await res.json()) as { success: boolean; data?: Record<string, unknown>; error?: string }
}

beforeEach(() => {
  mocks.limited = false
  mocks.product = { product: { id: 42, slug: 'test-product' } }
  mocks.reviewResult = { success: true }
  mocks.questionResult = { success: true }
  mocks.approvedReviews = []
  mocks.questionsList = { items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 }
  vi.clearAllMocks()
})

const params = { params: Promise.resolve({ slug: 'test-product' }) }

describe('POST /api/v1/products/[slug]/reviews — plain text', () => {
  const validReview = { authorName: 'Олег', rating: 5, text: 'Все супер, рекомендую' }

  it('strips markup before delegating to submitReview', async () => {
    const res = await postReview(
      postJson('http://localhost/api/v1/products/test-product/reviews', {
        ...validReview,
        text: '<script>alert(1)</script>Чудово <b>все</b>',
      }),
      params,
    )
    expect(res.status).toBe(200)
    const submitted = vi.mocked(submitReview).mock.calls[0][0] as { body: string }
    expect(submitted.body).toBe('Чудово все')
  })

  it('does NOT look up a supplied orderNumber — unknown numbers still submit', async () => {
    const res = await postReview(
      postJson('http://localhost/api/v1/products/test-product/reviews', {
        ...validReview,
        orderNumber: '000000000000',
      }),
      params,
    )
    expect(res.status).toBe(200)
    expect(vi.mocked(submitReview)).toHaveBeenCalledWith({
      productId: 42,
      rating: 5,
      body: 'Все супер, рекомендую',
      authorName: 'Олег',
    })
  })

  it('rejects markup-only text (strips to empty)', async () => {
    const res = await postReview(
      postJson('http://localhost/api/v1/products/test-product/reviews', { ...validReview, text: '<b></b>' }),
      params,
    )
    expect(res.status).toBe(400)
    expect(vi.mocked(submitReview)).not.toHaveBeenCalled()
  })
})

describe('GET /api/v1/products/[slug]/reviews — read path renders plain text', () => {
  it('returns the stored body as-is (plain text, no HTML)', async () => {
    mocks.approvedReviews = [
      { authorName: 'Олег', rating: 5, body: 'Чудово все', createdAt: new Date('2026-11-01T10:00:00Z') },
    ]
    const res = await getReviews(
      new Request('http://localhost/api/v1/products/test-product/reviews') as never,
      params,
    )
    expect(res.status).toBe(200)
    const body = await json(res)
    const items = body.data?.items as { text: string }[]
    expect(items[0].text).toBe('Чудово все')
  })
})

describe('POST /api/v1/products/[slug]/questions — plain text', () => {
  const validQuestion = { authorName: 'Олена', text: 'Чи є гарантія?' }

  it('strips markup before delegating to submitQuestion', async () => {
    const res = await postQuestion(
      postJson('http://localhost/api/v1/products/test-product/questions', {
        ...validQuestion,
        text: '<script>alert(1)</script>Чи є гарантія?',
      }),
      params,
    )
    expect(res.status).toBe(200)
    const submitted = vi.mocked(submitQuestion).mock.calls[0][0] as { question: string }
    expect(submitted.question).toBe('Чи є гарантія?')
  })

  it('rejects markup-only text (strips to empty)', async () => {
    const res = await postQuestion(
      postJson('http://localhost/api/v1/products/test-product/questions', {
        ...validQuestion,
        text: '<b></b>',
      }),
      params,
    )
    expect(res.status).toBe(400)
    expect(vi.mocked(submitQuestion)).not.toHaveBeenCalled()
  })
})
