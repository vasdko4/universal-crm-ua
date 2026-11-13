import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const dbState = vi.hoisted(() => ({ byTable: new Map<unknown, unknown[]>() }))
const rateState = vi.hoisted(() => ({ limited: false }))

vi.mock('@/lib/api/rate-limit', () => ({
  clientIp: () => '1.2.3.4',
  isRateLimited: async () => rateState.limited,
}))
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) =>
      Response.json(body as Record<string, unknown>, init),
  },
}))
vi.mock('@/lib/db', () => {
  const terminal = (table: unknown) => ({
    where: () => terminal(table),
    limit: async () => dbState.byTable.get(table) ?? [],
    orderBy: async () => dbState.byTable.get(table) ?? [],
  })
  return {
    db: { select: () => ({ from: (table: unknown) => terminal(table) }) },
    pool: { query: vi.fn() },
  }
})
vi.mock('@/lib/shop/queries', () => ({ getProductBySlug: vi.fn(), getApprovedReviews: vi.fn() }))
vi.mock('@/app/actions/shop', () => ({ submitReview: vi.fn() }))

import { GET as getOrder } from '@/app/api/v1/orders/[number]/route'
import { GET as getReviews, POST as postReview } from '@/app/api/v1/products/[slug]/reviews/route'
import { getApprovedReviews, getProductBySlug } from '@/lib/shop/queries'
import { submitReview } from '@/app/actions/shop'
import { orderItems, orders } from '@/lib/db/schema'

const mockedProductBySlug = vi.mocked(getProductBySlug)
const mockedApprovedReviews = vi.mocked(getApprovedReviews)
const mockedSubmitReview = vi.mocked(submitReview)

const root = resolve(import.meta.dirname, '..')
const source = (file: string) => readFileSync(resolve(root, file), 'utf8').replace(/\r\n/g, '\n')

const ORDER_NUMBER = '123456789012'
const orderRow = {
  id: 11,
  orderNumber: ORDER_NUMBER,
  status: 'shipped',
  paymentStatus: 'paid',
  paymentMethod: 'cod',
  customerPhone: '+380 (99) 123-45-67',
  customerEmail: 'buyer@example.com',
  note: 'internal note: do not ship before Friday',
  itemsTotal: '1000.00',
  deliveryCost: '150.00',
  discountTotal: '0.00',
  total: '1150.00',
  deliveryMethod: 'nova_poshta',
  deliveryCity: 'Київ',
  deliveryBranch: 'Відділення 5',
  deliveryAddress: null,
  trackingNumber: '20400000000000',
  createdAt: new Date('2026-11-10T10:00:00.000Z'),
}
const itemRows = [
  { id: 1, orderId: 11, name: 'Кабель ACEFAST', quantity: 2, price: '500.00' },
]

const reviewRows = [
  { id: 3, authorName: 'Олена', rating: 5, body: 'Чудовий кабель', createdAt: new Date('2026-11-09T10:00:00.000Z') },
  { id: 2, authorName: 'Ігор', rating: 4, body: 'Добре, але короткий', createdAt: new Date('2026-11-08T10:00:00.000Z') },
  { id: 1, authorName: 'Марія', rating: 3, body: 'Нормально', createdAt: new Date('2026-11-07T10:00:00.000Z') },
]

function getOrderReq(number: string, query = '') {
  return getOrder(
    new Request(`http://localhost/api/v1/orders/${number}${query}`) as never,
    { params: Promise.resolve({ number }) } as never,
  )
}

function getReviewsReq(slug: string, query = '') {
  return getReviews(
    new Request(`http://localhost/api/v1/products/${slug}/reviews${query}`) as never,
    { params: Promise.resolve({ slug }) } as never,
  )
}

function postReviewReq(slug: string, body: unknown) {
  return postReview(
    new Request(`http://localhost/api/v1/products/${slug}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }) as never,
    { params: Promise.resolve({ slug }) } as never,
  )
}

const validReview = { authorName: 'Олег', rating: 5, text: 'Все супер, рекомендую' }

describe('GET /api/v1/orders/[number]', () => {
  beforeEach(() => {
    dbState.byTable.clear()
    rateState.limited = false
    dbState.byTable.set(orders, [orderRow])
    dbState.byTable.set(orderItems, itemRows)
  })

  it('returns 404 without a phone', async () => {
    const res = await getOrderReq(ORDER_NUMBER)
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ success: false })
  })

  it('returns 404 for an unparseable phone', async () => {
    const res = await getOrderReq(ORDER_NUMBER, '?phone=abc')
    expect(res.status).toBe(404)
  })

  it('returns 404 for an unknown order number', async () => {
    dbState.byTable.set(orders, [])
    const res = await getOrderReq('000000000000', '?phone=0991234567')
    expect(res.status).toBe(404)
  })

  it('returns the same 404 for a wrong phone as for an unknown order', async () => {
    const wrong = await getOrderReq(ORDER_NUMBER, '?phone=0671112233')
    expect(wrong.status).toBe(404)
    const wrongBody = await wrong.json()
    dbState.byTable.set(orders, [])
    const unknown = await getOrderReq('000000000000', '?phone=0991234567')
    expect(unknown.status).toBe(404)
    expect(await unknown.json()).toEqual(wrongBody)
  })

  it('returns the safe order shape for the correct phone (any format)', async () => {
    const res = await getOrderReq(ORDER_NUMBER, '?phone=0991234567')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      success: true,
      data: {
        orderNumber: ORDER_NUMBER,
        status: 'shipped',
        paymentStatus: 'paid',
        paymentMethod: 'cod',
        items: [{ name: 'Кабель ACEFAST', quantity: 2, price: 500 }],
        totals: { itemsTotal: 1000, deliveryCost: 150, discountTotal: 0, total: 1150 },
        delivery: {
          method: 'nova_poshta',
          city: 'Київ',
          branch: 'Відділення 5',
          address: null,
          trackingNumber: '20400000000000',
        },
        createdAt: '2026-11-10T10:00:00.000Z',
      },
    })
    // Nothing sensitive leaks: no email, no stored phone, no internal note.
    const raw = JSON.stringify(body)
    expect(raw).not.toContain('buyer@example.com')
    expect(raw).not.toContain('internal note')
    expect(raw).not.toContain('customerPhone')
    expect(raw).not.toContain('customerEmail')
  })

  it('returns 429 when rate-limited', async () => {
    rateState.limited = true
    const res = await getOrderReq(ORDER_NUMBER, '?phone=0991234567')
    expect(res.status).toBe(429)
    expect(await res.json()).toMatchObject({ success: false })
  })
})

describe('GET /api/v1/products/[slug]/reviews', () => {
  beforeEach(() => {
    rateState.limited = false
    mockedProductBySlug.mockReset()
    mockedApprovedReviews.mockReset()
    mockedProductBySlug.mockImplementation(async (slug: string) =>
      slug === 'test-slug' ? ({ product: { id: 7 }, characteristics: [], categories: [] } as never) : null,
    )
    mockedApprovedReviews.mockResolvedValue(reviewRows as never)
  })

  it('returns 404 for an unknown slug', async () => {
    const res = await getReviewsReq('no-such-slug')
    expect(res.status).toBe(404)
    expect(mockedApprovedReviews).not.toHaveBeenCalled()
  })

  it('returns items, aggregate from the full list, and pagination meta', async () => {
    const res = await getReviewsReq('test-slug')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toMatchObject({
      aggregate: { count: 3, avg: 4 },
      total: 3,
      page: 1,
      perPage: 20,
    })
    expect(body.data.items).toEqual([
      { authorName: 'Олена', rating: 5, text: 'Чудовий кабель', createdAt: '2026-11-09T10:00:00.000Z' },
      { authorName: 'Ігор', rating: 4, text: 'Добре, але короткий', createdAt: '2026-11-08T10:00:00.000Z' },
      { authorName: 'Марія', rating: 3, text: 'Нормально', createdAt: '2026-11-07T10:00:00.000Z' },
    ])
    // No emails or moderation fields in the public list.
    expect(JSON.stringify(body)).not.toContain('authorEmail')
  })

  it('paginates the list but keeps the aggregate over all approved reviews', async () => {
    const res = await getReviewsReq('test-slug', '?page=2&perPage=1')
    const body = await res.json()
    expect(body.data.items).toHaveLength(1)
    expect(body.data.items[0].authorName).toBe('Ігор')
    expect(body.data.aggregate).toEqual({ count: 3, avg: 4 })
    expect(body.data.total).toBe(3)
    expect(body.data.page).toBe(2)
    expect(body.data.perPage).toBe(1)
  })

  it('rejects invalid pagination', async () => {
    for (const q of ['?page=abc', '?page=0', '?page=-1', '?perPage=101', '?perPage=0']) {
      const res = await getReviewsReq('test-slug', q)
      expect(res.status).toBe(400)
    }
  })

  it('returns 429 when rate-limited', async () => {
    rateState.limited = true
    const res = await getReviewsReq('test-slug')
    expect(res.status).toBe(429)
  })
})

describe('POST /api/v1/products/[slug]/reviews', () => {
  beforeEach(() => {
    dbState.byTable.clear()
    rateState.limited = false
    mockedProductBySlug.mockReset()
    mockedApprovedReviews.mockReset()
    mockedSubmitReview.mockReset()
    mockedProductBySlug.mockImplementation(async (slug: string) =>
      slug === 'test-slug' ? ({ product: { id: 7 }, characteristics: [], categories: [] } as never) : null,
    )
    mockedSubmitReview.mockResolvedValue({ success: true })
  })

  it('returns 404 for an unknown slug', async () => {
    const res = await postReviewReq('no-such-slug', validReview)
    expect(res.status).toBe(404)
    expect(mockedSubmitReview).not.toHaveBeenCalled()
  })

  it.each([0, 6, 4.5, '5', null])('rejects rating %s', async (rating) => {
    const res = await postReviewReq('test-slug', { ...validReview, rating })
    expect(res.status).toBe(400)
    expect(mockedSubmitReview).not.toHaveBeenCalled()
  })

  it.each(['', '   '])('rejects empty authorName %j', async (authorName) => {
    const res = await postReviewReq('test-slug', { ...validReview, authorName })
    expect(res.status).toBe(400)
  })

  it('rejects an overlong authorName', async () => {
    const res = await postReviewReq('test-slug', { ...validReview, authorName: 'x'.repeat(121) })
    expect(res.status).toBe(400)
  })

  it('rejects missing, empty, and overlong text', async () => {
    for (const text of [undefined, '', '   ', 'x'.repeat(5001)]) {
      const body = { ...validReview }
      if (text === undefined) delete (body as Record<string, unknown>).text
      else body.text = text
      const res = await postReviewReq('test-slug', body)
      expect(res.status).toBe(400)
    }
    expect(mockedSubmitReview).not.toHaveBeenCalled()
  })

  it('rejects a supplied orderNumber that does not exist', async () => {
    dbState.byTable.set(orders, [])
    const res = await postReviewReq('test-slug', { ...validReview, orderNumber: '000000000000' })
    expect(res.status).toBe(400)
    expect(mockedSubmitReview).not.toHaveBeenCalled()
  })

  it('accepts a supplied orderNumber that exists and submits the review', async () => {
    dbState.byTable.set(orders, [{ id: 11 }])
    const res = await postReviewReq('test-slug', { ...validReview, orderNumber: ORDER_NUMBER })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, data: { success: true } })
    expect(mockedSubmitReview).toHaveBeenCalledWith({
      productId: 7,
      rating: 5,
      body: 'Все супер, рекомендую',
      authorName: 'Олег',
    })
  })

  it('strips markup from the text before submitting', async () => {
    const res = await postReviewReq('test-slug', {
      ...validReview,
      text: '<script>alert(1)</script>Чудово <b>все</b>',
    })
    expect(res.status).toBe(200)
    const submitted = mockedSubmitReview.mock.calls[0][0] as { body: string }
    expect(submitted.body).not.toContain('<script')
    expect(submitted.body).not.toContain('alert(1)')
  })

  it('passes submitReview failures through as 400', async () => {
    mockedSubmitReview.mockResolvedValue({ success: false, error: 'Забагато запитів' })
    const res = await postReviewReq('test-slug', validReview)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ success: false, error: 'Забагато запитів' })
  })

  it('returns 429 when rate-limited', async () => {
    rateState.limited = true
    const res = await postReviewReq('test-slug', validReview)
    expect(res.status).toBe(429)
    expect(mockedSubmitReview).not.toHaveBeenCalled()
  })
})

describe('api v1 orders/reviews wiring', () => {
  it('uses distinct rate-limit scopes with the specified ceilings', () => {
    const ordersSrc = source('app/api/v1/orders/[number]/route.ts')
    expect(ordersSrc).toContain("isRateLimited('api-v1-order-lookup'")
    expect(ordersSrc).toContain('const MAX_PER_MIN = 30')
    const reviewsSrc = source('app/api/v1/products/[slug]/reviews/route.ts')
    expect(reviewsSrc).toContain("isRateLimited('api-v1-reviews-list'")
    expect(reviewsSrc).toContain('const LIST_MAX_PER_MIN = 60')
    expect(reviewsSrc).toContain("isRateLimited('api-v1-reviews-submit'")
    expect(reviewsSrc).toContain('const SUBMIT_MAX_PER_MIN = 5')
  })

  it('never emits customer email or internal notes from the order lookup', () => {
    const src = source('app/api/v1/orders/[number]/route.ts')
    // Object keys in the response shape (the doc comment mentions the words
    // in prose, so match keys, not substrings).
    expect(src).not.toMatch(/customerEmail\s*:/)
    expect(src).not.toMatch(/\bnote\s*:/)
    expect(src).not.toMatch(/customerName\s*:/)
  })
})
