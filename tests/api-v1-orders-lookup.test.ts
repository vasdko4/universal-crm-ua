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

import { GET as getOrder } from '@/app/api/v1/orders/[number]/route'
import { POST as postLookup } from '@/app/api/v1/orders/lookup/route'
import { orderItems, orders } from '@/lib/db/schema'

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

function postLookupReq(body: unknown, query = '') {
  return postLookup(
    new Request(`http://localhost/api/v1/orders/lookup${query}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }) as never,
  )
}

function postLookupRaw(rawBody: string | undefined) {
  const init: RequestInit =
    rawBody === undefined
      ? { method: 'POST' }
      : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: rawBody }
  return postLookup(new Request('http://localhost/api/v1/orders/lookup', init) as never)
}

function getOrderReq(number: string, query = '') {
  return getOrder(
    new Request(`http://localhost/api/v1/orders/${number}${query}`) as never,
    { params: Promise.resolve({ number }) } as never,
  )
}

describe('POST /api/v1/orders/lookup', () => {
  beforeEach(() => {
    dbState.byTable.clear()
    rateState.limited = false
    dbState.byTable.set(orders, [orderRow])
    dbState.byTable.set(orderItems, itemRows)
  })

  it('returns the safe order shape for the correct phone', async () => {
    const res = await postLookupReq({ number: ORDER_NUMBER, phone: '0991234567' })
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

  it('accepts the +380 formatted phone', async () => {
    const res = await postLookupReq({ number: ORDER_NUMBER, phone: '+380 (99) 123-45-67' })
    expect(res.status).toBe(200)
    expect((await res.json()) as Record<string, unknown>).toMatchObject({ success: true })
  })

  it('returns 404 without a phone', async () => {
    const res = await postLookupReq({ number: ORDER_NUMBER })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ success: false, error: 'Замовлення не знайдено' })
  })

  it('returns 404 for an unparseable phone', async () => {
    const res = await postLookupReq({ number: ORDER_NUMBER, phone: 'abc' })
    expect(res.status).toBe(404)
  })

  it('returns 404 for an unknown order number', async () => {
    dbState.byTable.set(orders, [])
    const res = await postLookupReq({ number: '000000000000', phone: '0991234567' })
    expect(res.status).toBe(404)
  })

  it('returns the same 404 for a wrong phone as for an unknown order (no probing)', async () => {
    const wrong = await postLookupReq({ number: ORDER_NUMBER, phone: '0671112233' })
    expect(wrong.status).toBe(404)
    const wrongBody = await wrong.json()
    dbState.byTable.set(orders, [])
    const unknown = await postLookupReq({ number: '000000000000', phone: '0991234567' })
    expect(unknown.status).toBe(404)
    expect(await unknown.json()).toEqual(wrongBody)
  })

  it('returns 404 without a number', async () => {
    const res = await postLookupReq({ phone: '0991234567' })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ success: false, error: 'Замовлення не знайдено' })
  })

  it('returns 404 for non-string number/phone (no 400 probing)', async () => {
    const res = await postLookupReq({ number: 123456789012, phone: 380991234567 })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ success: false, error: 'Замовлення не знайдено' })
  })

  it('returns 404 for malformed JSON (no 400 probing)', async () => {
    const res = await postLookupRaw('{not json')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ success: false, error: 'Замовлення не знайдено' })
  })

  it('returns 404 for an empty body (no 400 probing)', async () => {
    const res = await postLookupRaw(undefined)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ success: false, error: 'Замовлення не знайдено' })
  })

  it('returns 429 when rate-limited', async () => {
    rateState.limited = true
    const res = await postLookupReq({ number: ORDER_NUMBER, phone: '0991234567' })
    expect(res.status).toBe(429)
    expect(await res.json()).toMatchObject({ success: false })
  })

  it('ignores the phone in the query string — body only', async () => {
    const res = await postLookupReq({ number: ORDER_NUMBER }, '?phone=0991234567')
    expect(res.status).toBe(404)
  })
})

describe('GET /api/v1/orders/[number] (deprecated, still works)', () => {
  beforeEach(() => {
    dbState.byTable.clear()
    rateState.limited = false
    dbState.byTable.set(orders, [orderRow])
    dbState.byTable.set(orderItems, itemRows)
  })

  it('still returns 200 for the correct phone', async () => {
    const res = await getOrderReq(ORDER_NUMBER, '?phone=0991234567')
    expect(res.status).toBe(200)
    expect((await res.json()) as Record<string, unknown>).toMatchObject({
      success: true,
      data: { orderNumber: ORDER_NUMBER, status: 'shipped' },
    })
  })

  it('still returns 404 for a wrong phone', async () => {
    const res = await getOrderReq(ORDER_NUMBER, '?phone=0671112233')
    expect(res.status).toBe(404)
  })
})

describe('order lookup wiring (3.4.107 fix 4)', () => {
  it('documents the POST endpoint and the GET deprecation; POST shares the GET limit and reads the body', () => {
    const docs = source('docs/api-v1.md')
    expect(docs).toContain('POST `/api/v1/orders/lookup`')
    expect(docs).toContain('deprecated')
    expect(docs).toContain('access-лог')
    const getSrc = source('app/api/v1/orders/[number]/route.ts')
    expect(getSrc).toContain('@deprecated')
    expect(getSrc).toContain('lookupOrderByNumberAndPhone')
    expect(getSrc).toContain("isRateLimited('api-v1-order-lookup'")
    expect(getSrc).toContain('const MAX_PER_MIN = 30')
    const postSrc = source('app/api/v1/orders/lookup/route.ts')
    expect(postSrc).toContain("isRateLimited('api-v1-order-lookup'")
    expect(postSrc).toContain('const MAX_PER_MIN = 30')
    expect(postSrc).toContain('readJson')
    expect(postSrc).not.toContain('searchParams')
    const helperSrc = source('lib/api/order-lookup.ts')
    expect(helperSrc).toContain('lookupOrderByNumberAndPhone')
    expect(helperSrc).not.toMatch(/customerEmail\s*:/)
    expect(helperSrc).not.toMatch(/\bnote\s*:/)
  })
})
