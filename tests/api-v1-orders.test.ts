import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createStorefrontOrder } from '@/app/actions/shop'
import { isRateLimited } from '@/lib/api/rate-limit'

vi.mock('@/lib/api/rate-limit', () => ({
  clientIp: vi.fn(() => '1.2.3.4'),
  isRateLimited: vi.fn(async () => false),
}))
vi.mock('@/lib/shop/queries', () => ({
  getActiveDeliveryMethods: vi.fn(async () => [
    { code: 'nova_poshta' },
    { code: 'ukrposhta' },
    { code: 'pickup' },
  ]),
  getActivePaymentMethods: vi.fn(async () => [
    { code: 'online' },
    { code: 'cod' },
    { code: 'requisites' },
  ]),
}))
vi.mock('@/app/actions/shop', () => ({
  createStorefrontOrder: vi.fn(async () => ({
    success: true,
    orderId: 1,
    orderNumber: '123456789012',
    total: 500,
    itemsTotal: 500,
    discount: 0,
    paymentMethod: 'cod',
  })),
}))
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) =>
      Response.json(body as Record<string, unknown>, init),
  },
}))

import { POST } from '@/app/api/v1/orders/route'

const mockedCreate = vi.mocked(createStorefrontOrder)
const mockedRateLimited = vi.mocked(isRateLimited)

const root = resolve(import.meta.dirname, '..')
const source = (file: string) => readFileSync(resolve(root, file), 'utf8').replace(/\r\n/g, '\n')

function validBody(): Record<string, unknown> {
  return {
    items: [{ productId: 1, quantity: 2 }],
    customer: {
      firstName: 'Іван',
      lastName: 'Тест',
      phone: '0671234567',
      email: 'test@example.com',
    },
    delivery: { method: 'nova_poshta', city: 'Київ', branch: 'Відділення №1' },
    payment: { method: 'cod' },
  }
}

function post(body: unknown) {
  return POST(
    new Request('http://localhost/api/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }) as never,
  )
}

describe('POST /api/v1/orders — guest checkout', () => {
  beforeEach(() => {
    mockedCreate.mockClear()
    mockedRateLimited.mockClear()
    mockedRateLimited.mockResolvedValue(false)
    mockedCreate.mockResolvedValue({
      success: true,
      orderId: 1,
      orderNumber: '123456789012',
      total: 500,
      itemsTotal: 500,
      discount: 0,
      paymentMethod: 'cod',
    } as never)
  })

  it('creates an order and returns the website-checkout result', async () => {
    const res = await post(validBody())
    expect(res.status).toBe(200)
    const json = (await res.json()) as Record<string, unknown>
    expect(json).toMatchObject({
      success: true,
      data: { orderId: 1, orderNumber: '123456789012', total: 500, paymentMethod: 'cod' },
    })
    expect(mockedCreate).toHaveBeenCalledTimes(1)
    expect(mockedCreate).toHaveBeenCalledWith({
      firstName: 'Іван',
      lastName: 'Тест',
      phone: '+380671234567',
      email: 'test@example.com',
      deliveryMethod: 'nova_poshta',
      deliveryCity: 'Київ',
      deliveryBranch: 'Відділення №1',
      paymentMethod: 'cod',
      items: [{ productId: 1, quantity: 2 }],
    })
  })

  it('normalizes the phone to +380 and forwards variantId / promo / note / idempotencyKey', async () => {
    const body = validBody()
    body.items = [{ productId: 7, quantity: 1, variantId: 5 }]
    body.customer = { firstName: 'Оля', phone: '+380 (67) 123-45-67' }
    body.promoCode = 'SALE10'
    body.note = 'Передзвоніть'
    body.idempotencyKey = 'A8098C1A-F86E-11DA-BD1A-00112444BE1E'
    const res = await post(body)
    expect(res.status).toBe(200)
    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: '+380671234567',
        promoCode: 'SALE10',
        note: 'Передзвоніть',
        idempotencyKey: 'a8098c1a-f86e-11da-bd1a-00112444be1e',
        items: [{ productId: 7, quantity: 1, variantId: 5 }],
      }),
    )
  })

  it('rejects empty items and never calls the checkout', async () => {
    const body = validBody()
    body.items = []
    const res = await post(body)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ success: false })
    expect(mockedCreate).not.toHaveBeenCalled()
  })

  it('rejects bad quantities and productIds', async () => {
    for (const items of [
      [{ productId: 1, quantity: 0 }],
      [{ productId: 1, quantity: 100 }],
      [{ productId: 1, quantity: 1.5 }],
      [{ productId: 0, quantity: 1 }],
      [{ productId: -3, quantity: 1 }],
      [{ productId: 'abc', quantity: 1 }],
      [{ productId: 1, quantity: 1, variantId: 0 }],
    ]) {
      const body = validBody()
      body.items = items
      const res = await post(body)
      expect(res.status).toBe(400)
    }
    expect(mockedCreate).not.toHaveBeenCalled()
  })

  it('rejects more than 50 lines', async () => {
    const body = validBody()
    body.items = Array.from({ length: 51 }, (_, i) => ({ productId: i + 1, quantity: 1 }))
    const res = await post(body)
    expect(res.status).toBe(400)
    expect(mockedCreate).not.toHaveBeenCalled()
  })

  it('rejects an unknown delivery method and lists the allowed ones', async () => {
    const body = validBody()
    ;(body.delivery as Record<string, unknown>).method = 'pigeon'
    const res = await post(body)
    expect(res.status).toBe(400)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toContain('nova_poshta')
    expect(mockedCreate).not.toHaveBeenCalled()
  })

  it('rejects an unknown payment method', async () => {
    const body = validBody()
    ;(body.payment as Record<string, unknown>).method = 'barter'
    const res = await post(body)
    expect(res.status).toBe(400)
    expect(mockedCreate).not.toHaveBeenCalled()
  })

  it('rejects a missing customer / delivery / payment object', async () => {
    for (const key of ['customer', 'delivery', 'payment'] as const) {
      const body = validBody()
      delete body[key]
      const res = await post(body)
      expect(res.status).toBe(400)
    }
    expect(mockedCreate).not.toHaveBeenCalled()
  })

  it('rejects an invalid phone and a missing firstName', async () => {
    for (const customer of [
      { firstName: 'Іван', phone: '123' },
      { firstName: 'Іван', phone: 'not-a-phone' },
      { firstName: '   ', phone: '0671234567' },
    ]) {
      const body = validBody()
      body.customer = customer
      const res = await post(body)
      expect(res.status).toBe(400)
    }
    expect(mockedCreate).not.toHaveBeenCalled()
  })

  it('rejects an invalid email', async () => {
    const body = validBody()
    ;(body.customer as Record<string, unknown>).email = 'not-an-email'
    const res = await post(body)
    expect(res.status).toBe(400)
    expect(mockedCreate).not.toHaveBeenCalled()
  })

  it('rejects a malformed idempotencyKey', async () => {
    const body = validBody()
    body.idempotencyKey = 'not-a-uuid'
    const res = await post(body)
    expect(res.status).toBe(400)
    expect(mockedCreate).not.toHaveBeenCalled()
  })

  it('ignores client-sent prices, totals and discounts', async () => {
    const body = validBody()
    body.items = [{ productId: 1, quantity: 2, price: 1 }]
    body.total = 1
    body.itemsTotal = 1
    body.discount = 999
    body.deliveryCost = 0
    const res = await post(body)
    expect(res.status).toBe(200)
    expect(mockedCreate).toHaveBeenCalledTimes(1)
    const input = mockedCreate.mock.calls[0]![0] as Record<string, unknown>
    expect(input).not.toHaveProperty('total')
    expect(input).not.toHaveProperty('itemsTotal')
    expect(input).not.toHaveProperty('discount')
    expect(input).not.toHaveProperty('deliveryCost')
    expect(input).not.toHaveProperty('price')
    expect(input.items).toEqual([{ productId: 1, quantity: 2 }])
  })

  it('surfaces a checkout validation failure as 400 with its message', async () => {
    mockedCreate.mockResolvedValueOnce({ success: false, error: 'Товар недоступний' } as never)
    const res = await post(validBody())
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ success: false, error: 'Товар недоступний' })
  })

  it('returns 409 with retryable + orderNumber when the order is still being created', async () => {
    mockedCreate.mockResolvedValueOnce({
      success: false,
      retryable: true,
      orderNumber: '123456789012',
    } as never)
    const res = await post(validBody())
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({
      success: false,
      retryable: true,
      orderNumber: '123456789012',
    })
  })

  it('returns a generic 500 without leaking internals when the checkout throws', async () => {
    mockedCreate.mockRejectedValueOnce(new Error('ECONNREFUSED db.internal:5432 secret'))
    const res = await post(validBody())
    expect(res.status).toBe(500)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toBe('Не удалось создать заказ')
    expect(json.error).not.toContain('ECONNREFUSED')
    expect(json.error).not.toContain('secret')
  })

  it('returns 429 and never calls the checkout when rate-limited', async () => {
    mockedRateLimited.mockResolvedValueOnce(true)
    const res = await post(validBody())
    expect(res.status).toBe(429)
    expect(await res.json()).toMatchObject({ success: false })
    expect(mockedCreate).not.toHaveBeenCalled()
  })

  it('rejects malformed JSON', async () => {
    const res = await POST(
      new Request('http://localhost/api/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json{',
      }) as never,
    )
    expect(res.status).toBe(400)
    expect(mockedCreate).not.toHaveBeenCalled()
  })
})

describe('POST /api/v1/orders wiring (REST API v1, guest checkout)', () => {
  it('delegates order creation to createStorefrontOrder', () => {
    const src = source('app/api/v1/orders/route.ts')
    expect(src).toContain('createStorefrontOrder(validated.value)')
    expect(src).not.toContain('createOrder(')
  })

  it('uses the shared ok/fail envelope and the bounded readJson', () => {
    const src = source('app/api/v1/orders/route.ts')
    expect(src).toContain("from '@/lib/api/helpers'")
    expect(src).toContain('readJson')
    expect(src).toContain('ok({')
    expect(src).toContain('fail(')
  })

  it('rate-limits at 5/min on its own scope before doing order work', () => {
    const src = source('app/api/v1/orders/route.ts')
    expect(src).toContain("isRateLimited(RATE_LIMIT_SCOPE, ip, RATE_LIMIT_MAX_PER_MIN)")
    expect(src).toContain("RATE_LIMIT_SCOPE = 'v1-orders'")
    expect(src).toContain('RATE_LIMIT_MAX_PER_MIN = 5')
  })

  it('reads only method codes from the DB — never the config column', () => {
    const src = source('app/api/v1/orders/route.ts')
    expect(src).toContain('map((m) => m.code)')
    expect(src).not.toMatch(/\.config\b/)
  })

  it('caps quantity at 99 per line', () => {
    const src = source('app/api/v1/orders/route.ts')
    expect(src).toContain('MAX_QUANTITY_PER_LINE = 99')
  })
})
