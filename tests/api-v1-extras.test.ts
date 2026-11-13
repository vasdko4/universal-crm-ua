import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getDictionary } from '@/lib/i18n/dictionaries'

// Mutable mock state lives in vi.hoisted(): vi.mock factories run before the
// module body, so plain top-level consts would hit the TDZ.
const mocks = vi.hoisted(() => ({
  limited: false,
  shopUser: null as { id: string; name: string; email: string; phone: string | null } | null,
  // getProductBySlug returns { product, characteristics, categories }.
  product: null as { product: { id: number; slug: string }; characteristics: unknown[]; categories: unknown[] } | null,
  orderRow: null as Record<string, unknown> | null,
  paymentRow: null as Record<string, unknown> | null,
  oneClickResult: {
    success: true,
    orderId: 7,
    orderNumber: '123456789012',
    total: 499,
    itemsTotal: 499,
  } as unknown,
  questionResult: { success: true } as unknown,
  questionsList: {
    items: [
      {
        id: 1,
        productId: 42,
        authorName: 'Олена',
        question: 'Чи є гарантія?',
        answer: 'Так, 12 місяців.',
        answeredAt: new Date('2026-11-01T10:00:00Z'),
        createdAt: new Date('2026-10-30T10:00:00Z'),
      },
    ],
    total: 1,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  } as unknown,
  myOrders: [] as unknown[],
  myOrderDetail: null as unknown,
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
  createOneClickOrder: vi.fn(async () => mocks.oneClickResult),
  submitQuestion: vi.fn(async () => mocks.questionResult),
  getMyOrders: vi.fn(async () => mocks.myOrders),
  getMyOrderDetail: vi.fn(async () => mocks.myOrderDetail),
}))
vi.mock('@/lib/shop/queries', () => ({
  getProductBySlug: vi.fn(async () => mocks.product),
}))
vi.mock('@/app/actions/feedback', () => ({
  getPublicAnsweredQuestions: vi.fn(async () => mocks.questionsList),
}))
vi.mock('@/lib/session', () => ({
  getShopUser: vi.fn(async () => mocks.shopUser),
}))
// Drizzle chain stub: the payment route reads orders via
// .where().limit(1) and payments via .where().orderBy().limit(1) — the two
// shapes are told apart by the chain, so no schema identity is needed.
vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (mocks.orderRow ? [mocks.orderRow] : []),
          orderBy: () => ({
            limit: async () => (mocks.paymentRow ? [mocks.paymentRow] : []),
          }),
        }),
      }),
    }),
  },
}))

import { POST as postOneClick } from '@/app/api/v1/orders/one-click/route'
import {
  GET as getQuestions,
  POST as postQuestion,
} from '@/app/api/v1/products/[slug]/questions/route'
import { GET as getPayment } from '@/app/api/v1/orders/[number]/payment/route'
import { GET as getMeOrders } from '@/app/api/v1/me/orders/route'
import { GET as getMeOrder } from '@/app/api/v1/me/orders/[id]/route'
import { getPublicAnsweredQuestions } from '@/app/actions/feedback'
import { createOneClickOrder } from '@/app/actions/shop'

const mockedQuestions = vi.mocked(getPublicAnsweredQuestions)
const mockedOneClick = vi.mocked(createOneClickOrder)

const ORDER_ROW = {
  orderNumber: '123456789012',
  customerPhone: '+380671112233',
  paymentStatus: 'unpaid',
  status: 'new',
}
const PAID_ROW = { status: 'paid' }

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
  mocks.shopUser = null
  mocks.product = {
    product: { id: 42, slug: 'test-product' },
    characteristics: [],
    categories: [],
  }
  mocks.orderRow = null
  mocks.paymentRow = null
  mocks.oneClickResult = {
    success: true,
    orderId: 7,
    orderNumber: '123456789012',
    total: 499,
    itemsTotal: 499,
  }
  mocks.questionResult = { success: true }
  mocks.myOrders = []
  mocks.myOrderDetail = null
  vi.clearAllMocks()
})

describe('POST /api/v1/orders/one-click', () => {
  const body = { productId: 42, name: 'Іван', phone: '+380671112233' }

  it('creates an order and returns its number and totals', async () => {
    const res = await postOneClick(postJson('http://localhost/api/v1/orders/one-click', body))
    const data = await json(res)
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data).toMatchObject({ orderNumber: '123456789012', total: 499 })
    expect(mockedOneClick).toHaveBeenCalledWith({
      productId: 42,
      variantId: undefined,
      name: 'Іван',
      phone: '+380671112233',
      idempotencyKey: undefined,
    })
  })

  it('rejects a bad productId', async () => {
    for (const bad of [0, -3, 1.5, '42', null]) {
      const res = await postOneClick(
        postJson('http://localhost/api/v1/orders/one-click', { ...body, productId: bad }),
      )
      expect(res.status).toBe(400)
    }
    expect(mockedOneClick).not.toHaveBeenCalled()
  })

  it('rejects quantity other than 1 (one-click is single-unit by design)', async () => {
    const res = await postOneClick(
      postJson('http://localhost/api/v1/orders/one-click', { ...body, quantity: 2 }),
    )
    expect(res.status).toBe(400)
    expect(mockedOneClick).not.toHaveBeenCalled()
  })

  it('rejects a malformed idempotencyKey', async () => {
    const res = await postOneClick(
      postJson('http://localhost/api/v1/orders/one-click', { ...body, idempotencyKey: 'not-a-uuid' }),
    )
    expect(res.status).toBe(400)
    expect(mockedOneClick).not.toHaveBeenCalled()
  })

  it('accepts a UUID idempotencyKey and passes it through', async () => {
    const key = '123e4567-e89b-12d3-a456-426614174000'
    const res = await postOneClick(
      postJson('http://localhost/api/v1/orders/one-click', { ...body, idempotencyKey: key }),
    )
    expect(res.status).toBe(200)
    expect(mockedOneClick).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: key }))
  })

  it('surfaces an action validation error as 400', async () => {
    mocks.oneClickResult = { success: false, error: 'Невірний телефон' }
    const res = await postOneClick(postJson('http://localhost/api/v1/orders/one-click', body))
    expect(res.status).toBe(400)
    expect((await json(res)).error).toBe('Невірний телефон')
  })

  it('maps the action rate-limit error to 429', async () => {
    mocks.oneClickResult = {
      success: false,
      error: getDictionary('ru').serverErrors.rateLimitOrders,
    }
    const res = await postOneClick(postJson('http://localhost/api/v1/orders/one-click', body))
    expect(res.status).toBe(429)
  })

  it('returns 429 when rate-limited and does not call the action', async () => {
    mocks.limited = true
    const res = await postOneClick(postJson('http://localhost/api/v1/orders/one-click', body))
    expect(res.status).toBe(429)
    expect(mockedOneClick).not.toHaveBeenCalled()
  })
})

describe('GET /api/v1/products/[slug]/questions', () => {
  const params = { params: Promise.resolve({ slug: 'test-product' }) }

  it('returns answered questions with pagination', async () => {
    const res = await getQuestions(
      new Request('http://localhost/api/v1/products/test-product/questions?page=1&perPage=20') as never,
      params,
    )
    const data = await json(res)
    expect(res.status).toBe(200)
    expect(data.data).toMatchObject({ total: 1, page: 1, perPage: 20, totalPages: 1 })
    const items = data.data?.items as Record<string, unknown>[]
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ authorName: 'Олена', question: 'Чи є гарантія?' })
    expect(items[0]).not.toHaveProperty('productId')
    expect(mockedQuestions).toHaveBeenCalledWith({ productId: 42, page: 1, pageSize: 20 })
  })

  it('returns 404 for an unknown slug', async () => {
    mocks.product = null
    const res = await getQuestions(
      new Request('http://localhost/api/v1/products/nope/questions') as never,
      { params: Promise.resolve({ slug: 'nope' }) },
    )
    expect(res.status).toBe(404)
    expect(mockedQuestions).not.toHaveBeenCalled()
  })

  it('rejects bad pagination', async () => {
    for (const q of ['page=0', 'page=abc', 'perPage=0', 'perPage=101']) {
      const res = await getQuestions(
        new Request(`http://localhost/api/v1/products/test-product/questions?${q}`) as never,
        params,
      )
      expect(res.status).toBe(400)
    }
  })

  it('returns 429 when rate-limited', async () => {
    mocks.limited = true
    const res = await getQuestions(
      new Request('http://localhost/api/v1/products/test-product/questions') as never,
      params,
    )
    expect(res.status).toBe(429)
  })
})

describe('POST /api/v1/products/[slug]/questions', () => {
  const params = { params: Promise.resolve({ slug: 'test-product' }) }
  const body = { authorName: 'Олена', text: 'Чи є гарантія?' }

  it('submits a question and reports moderation status', async () => {
    const res = await postQuestion(
      postJson('http://localhost/api/v1/products/test-product/questions', body),
      params,
    )
    const data = await json(res)
    expect(res.status).toBe(200)
    expect(data.data).toMatchObject({ status: 'pending' })
  })

  it('strips markup from the question text', async () => {
    const { submitQuestion } = await import('@/app/actions/shop')
    const res = await postQuestion(
      postJson('http://localhost/api/v1/products/test-product/questions', {
        ...body,
        text: '<script>alert(1)</script>Чи є гарантія?',
      }),
      params,
    )
    expect(res.status).toBe(200)
    const called = vi.mocked(submitQuestion).mock.calls[0]?.[0] as { question: string }
    expect(called.question).not.toContain('<script>')
    expect(called.question).toContain('Чи є гарантія?')
  })

  it('rejects empty name and empty text', async () => {
    for (const bad of [
      { ...body, authorName: '   ' },
      { ...body, text: '' },
      { ...body, text: '   ' },
      { ...body, text: '<b></b>' },
    ]) {
      const res = await postQuestion(
        postJson('http://localhost/api/v1/products/test-product/questions', bad),
        params,
      )
      expect(res.status).toBe(400)
    }
  })

  it('rejects a malformed email', async () => {
    const res = await postQuestion(
      postJson('http://localhost/api/v1/products/test-product/questions', {
        ...body,
        email: 'not-an-email',
      }),
      params,
    )
    expect(res.status).toBe(400)
  })

  it('returns 404 for an unknown slug', async () => {
    mocks.product = null
    const res = await postQuestion(
      postJson('http://localhost/api/v1/products/nope/questions', body),
      { params: Promise.resolve({ slug: 'nope' }) },
    )
    expect(res.status).toBe(404)
  })

  it('returns 429 when rate-limited', async () => {
    mocks.limited = true
    const res = await postQuestion(
      postJson('http://localhost/api/v1/products/test-product/questions', body),
      params,
    )
    expect(res.status).toBe(429)
  })
})

describe('GET /api/v1/orders/[number]/payment', () => {
  const params = { params: Promise.resolve({ number: '123456789012' }) }
  const url = (phone?: string) =>
    `http://localhost/api/v1/orders/123456789012/payment${phone ? `?phone=${encodeURIComponent(phone)}` : ''}`

  it('returns paid=true for a paid payment row', async () => {
    mocks.orderRow = { ...ORDER_ROW }
    mocks.paymentRow = { ...PAID_ROW }
    const res = await getPayment(new Request(url('+380671112233')) as never, params)
    const data = await json(res)
    expect(res.status).toBe(200)
    expect(data.data).toMatchObject({
      orderNumber: '123456789012',
      paid: true,
      paymentStatus: 'paid',
    })
  })

  it('falls back to the order paymentStatus when there is no payment row (COD)', async () => {
    mocks.orderRow = { ...ORDER_ROW }
    mocks.paymentRow = null
    const res = await getPayment(new Request(url('0671112233')) as never, params)
    const data = await json(res)
    expect(res.status).toBe(200)
    expect(data.data).toMatchObject({ paid: false, paymentStatus: 'unpaid' })
  })

  it('returns the same 404 without a phone, with a wrong phone, and for an unknown order', async () => {
    mocks.orderRow = { ...ORDER_ROW }
    mocks.paymentRow = { ...PAID_ROW }
    const cases = [
      new Request(url()) as never,
      new Request(url('+380999999999')) as never,
      new Request(url('not-a-phone')) as never,
    ]
    for (const req of cases) {
      const res = await getPayment(req, params)
      expect(res.status).toBe(404)
      expect((await json(res)).error).toBe('Замовлення не знайдено')
    }
    mocks.orderRow = null
    const res = await getPayment(new Request(url('+380671112233')) as never, params)
    expect(res.status).toBe(404)
    expect((await json(res)).error).toBe('Замовлення не знайдено')
  })

  it('returns 429 when rate-limited', async () => {
    mocks.limited = true
    mocks.orderRow = { ...ORDER_ROW }
    const res = await getPayment(new Request(url('+380671112233')) as never, params)
    expect(res.status).toBe(429)
  })
})

describe('GET /api/v1/me/orders', () => {
  it('returns 401 without a session', async () => {
    const res = await getMeOrders(new Request('http://localhost/api/v1/me/orders') as never)
    expect(res.status).toBe(401)
  })

  it('returns the customer order list for a signed-in user', async () => {
    mocks.shopUser = { id: 'u1', name: 'Іван', email: 'i@example.com', phone: '+380671112233' }
    mocks.myOrders = [
      {
        id: 7,
        orderNumber: '123456789012',
        status: 'new',
        paymentStatus: 'unpaid',
        createdAt: new Date('2026-11-10T10:00:00Z'),
        total: '499.00',
        itemsCount: 1,
        items: [
          {
            id: 1,
            productId: 42,
            name: 'Товар',
            image: null,
            quantity: 1,
            price: '499.00',
            total: '499.00',
            variantLabel: null,
          },
        ],
        productSlugs: { 42: 'test-product' },
      },
    ]
    const res = await getMeOrders(new Request('http://localhost/api/v1/me/orders') as never)
    const data = await json(res)
    expect(res.status).toBe(200)
    expect(data.data).toMatchObject({ total: 1 })
    const items = data.data?.items as Record<string, unknown>[]
    expect(items[0]).toMatchObject({ orderNumber: '123456789012', total: 499 })
    const lines = items[0]?.items as Record<string, unknown>[]
    expect(lines[0]).toMatchObject({ price: 499, total: 499 })
  })

  it('returns 429 when rate-limited', async () => {
    mocks.limited = true
    const res = await getMeOrders(new Request('http://localhost/api/v1/me/orders') as never)
    expect(res.status).toBe(429)
  })
})

describe('GET /api/v1/me/orders/[id]', () => {
  const params = { params: Promise.resolve({ id: '7' }) }

  it('returns 401 without a session', async () => {
    const res = await getMeOrder(new Request('http://localhost/api/v1/me/orders/7') as never, params)
    expect(res.status).toBe(401)
  })

  it('returns the order detail without note and userId', async () => {
    mocks.shopUser = { id: 'u1', name: 'Іван', email: 'i@example.com', phone: '+380671112233' }
    mocks.myOrderDetail = {
      order: {
        id: 7,
        orderNumber: '123456789012',
        status: 'new',
        paymentStatus: 'unpaid',
        paymentMethod: 'cod',
        note: 'Реквізити: IBAN UA00...',
        createdAt: new Date('2026-11-10T10:00:00Z'),
        total: '499.00',
        discountTotal: '0',
        promoCode: null,
        trackingNumber: null,
        customerName: 'Іван',
        customerPhone: '+380671112233',
        customerEmail: 'i@example.com',
        deliveryMethod: 'nova-poshta',
        deliveryCity: 'Київ',
        deliveryBranch: 'Відділення 1',
        deliveryAddress: null,
        userId: 'u1',
      },
      items: [],
      productSlugs: {},
    }
    const res = await getMeOrder(new Request('http://localhost/api/v1/me/orders/7') as never, params)
    const data = await json(res)
    expect(res.status).toBe(200)
    const order = data.data?.order as Record<string, unknown>
    expect(order).toMatchObject({ orderNumber: '123456789012', total: 499 })
    expect(order).not.toHaveProperty('note')
    expect(order).not.toHaveProperty('userId')
  })

  it('returns 404 for an unknown id and for a bad id', async () => {
    mocks.shopUser = { id: 'u1', name: 'Іван', email: 'i@example.com', phone: '+380671112233' }
    mocks.myOrderDetail = null
    const res = await getMeOrder(new Request('http://localhost/api/v1/me/orders/7') as never, params)
    expect(res.status).toBe(404)
    const bad = await getMeOrder(new Request('http://localhost/api/v1/me/orders/abc') as never, {
      params: Promise.resolve({ id: 'abc' }),
    })
    expect(bad.status).toBe(404)
  })

  it('returns 429 when rate-limited', async () => {
    mocks.limited = true
    const res = await getMeOrder(new Request('http://localhost/api/v1/me/orders/7') as never, params)
    expect(res.status).toBe(429)
  })
})
