import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

vi.mock('@/lib/api/rate-limit', () => ({
  clientIp: vi.fn(() => '1.2.3.4'),
  isRateLimited: vi.fn(async () => false),
}))
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) =>
      Response.json(body as Record<string, unknown>, init),
  },
}))
vi.mock('@/lib/shop/queries', () => ({
  getActiveDeliveryMethods: vi.fn(),
  getActivePaymentMethods: vi.fn(),
  getActiveGateways: vi.fn(),
}))
vi.mock('@/app/actions/settings-store', () => ({
  getPublicStoreSettings: vi.fn(),
}))
vi.mock('@/app/actions/nova-poshta', () => ({
  searchCities: vi.fn(),
  searchWarehouses: vi.fn(),
}))

import { isRateLimited } from '@/lib/api/rate-limit'
import {
  getActiveDeliveryMethods,
  getActivePaymentMethods,
  getActiveGateways,
} from '@/lib/shop/queries'
import { getPublicStoreSettings } from '@/app/actions/settings-store'
import { searchCities, searchWarehouses } from '@/app/actions/nova-poshta'
import { GET as getStore } from '@/app/api/v1/store/route'
import { GET as getCities } from '@/app/api/v1/delivery/nova-poshta/cities/route'
import { GET as getWarehouses } from '@/app/api/v1/delivery/nova-poshta/warehouses/route'

const mockedRateLimited = vi.mocked(isRateLimited)
const mockedDelivery = vi.mocked(getActiveDeliveryMethods)
const mockedPayment = vi.mocked(getActivePaymentMethods)
const mockedGateways = vi.mocked(getActiveGateways)
const mockedSettings = vi.mocked(getPublicStoreSettings)
const mockedSearchCities = vi.mocked(searchCities)
const mockedSearchWarehouses = vi.mocked(searchWarehouses)

const root = resolve(import.meta.dirname, '..')
const source = (file: string) => readFileSync(resolve(root, file), 'utf8').replace(/\r\n/g, '\n')

const methodRow = (code: string, name: string, config: Record<string, unknown> = {}) =>
  ({
    id: 1,
    code,
    name,
    isActive: true,
    isRemovable: true,
    config,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }) as never

const baseSettings = {
  storeName: 'PowerFox',
  contact: {
    phones: ['+380 (63) 525-94-18'],
    address: 'вул. Левицького, 58, с. Міньківці',
    workingHours: {},
    widget: {
      enabled: true,
      channels: { email: { value: 'support@powerfox.shop', enabled: true } },
    },
  },
  emailSettings: { enabled: true, fromEmail: 'noreply@powerfox.shop' },
} as never

async function getJson(res: Response) {
  return (await res.json()) as Record<string, any>
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedRateLimited.mockResolvedValue(false)
  mockedDelivery.mockResolvedValue([
    methodRow('nova_poshta', 'Нова Пошта', { apiKey: 'NP-SECRET' }),
    methodRow('ukrposhta', 'Укрпошта', {}),
  ])
  mockedPayment.mockResolvedValue([
    methodRow('cod', 'Накладений платіж', {}),
    methodRow('online', 'Онлайн оплата', { merchantId: 'M-1' }),
    methodRow('requisites', 'Оплата за реквізитами', { iban: 'UA000000000000000000000000000' }),
  ])
  mockedGateways.mockResolvedValue([])
  mockedSettings.mockResolvedValue(baseSettings)
  mockedSearchCities.mockResolvedValue([
    { ref: 'city-1', name: 'Київ', area: 'Київська', deliveryCityRef: 'dc-1' },
  ])
  mockedSearchWarehouses.mockResolvedValue([{ ref: 'wh-1', name: 'Відділення №1', number: '1' }])
})

describe('GET /api/v1/store', () => {
  it('returns store meta with methods projected to code+name only, no config/secrets', async () => {
    const res = await getStore(new Request('http://localhost/api/v1/store'))
    expect(res.status).toBe(200)
    const body = await getJson(res)
    expect(body.success).toBe(true)
    expect(body.data.name).toBe('PowerFox')
    expect(body.data.phone).toBe('+380 (63) 525-94-18')
    expect(body.data.email).toBe('support@powerfox.shop')
    expect(body.data.address).toBe('вул. Левицького, 58, с. Міньківці')
    expect(body.data.currency).toBe('UAH')
    expect(body.data.deliveryMethods).toEqual([
      { code: 'nova_poshta', name: 'Нова Пошта' },
      { code: 'ukrposhta', name: 'Укрпошта' },
    ])
    // No config column, no secrets anywhere in the payload — even though
    // the mocked rows carry an NP apiKey, a merchant id and an IBAN.
    expect(JSON.stringify(body)).not.toContain('NP-SECRET')
    expect(JSON.stringify(body)).not.toContain('M-1')
    expect(JSON.stringify(body)).not.toContain('UA000000000000000000000000000')
    expect(JSON.stringify(body)).not.toContain('config')
    expect(JSON.stringify(body)).not.toContain('apiKey')
    // The active-only guarantee comes from the checkout's queries.
    expect(mockedDelivery).toHaveBeenCalledTimes(1)
    expect(mockedPayment).toHaveBeenCalledTimes(1)
  })

  it('hides the online payment method when no gateway is configured', async () => {
    const res = await getStore(new Request('http://localhost/api/v1/store'))
    const body = await getJson(res)
    expect(body.data.paymentMethods).toEqual([
      { code: 'cod', name: 'Накладений платіж' },
      { code: 'requisites', name: 'Оплата за реквізитами' },
    ])
  })

  it('shows the online payment method when a gateway is configured', async () => {
    mockedGateways.mockResolvedValue([{ code: 'wayforpay' }] as never)
    const res = await getStore(new Request('http://localhost/api/v1/store'))
    const body = await getJson(res)
    expect(body.data.paymentMethods).toEqual([
      { code: 'cod', name: 'Накладений платіж' },
      { code: 'online', name: 'Онлайн оплата' },
      { code: 'requisites', name: 'Оплата за реквізитами' },
    ])
  })

  it('falls back to the sender email when the widget email is empty', async () => {
    mockedSettings.mockResolvedValue({
      ...baseSettings,
      contact: {
        ...baseSettings.contact,
        widget: { enabled: true, channels: { email: { value: '   ', enabled: true } } },
      },
    } as never)
    const body = await getJson(await getStore(new Request('http://localhost/api/v1/store')))
    expect(body.data.email).toBe('noreply@powerfox.shop')
  })

  it('omits email when neither widget nor sender email is available', async () => {
    mockedSettings.mockResolvedValue({
      ...baseSettings,
      contact: {
        ...baseSettings.contact,
        widget: { enabled: true, channels: { email: { value: '', enabled: false } } },
      },
      emailSettings: { enabled: false, fromEmail: 'noreply@powerfox.shop' },
    } as never)
    const body = await getJson(await getStore(new Request('http://localhost/api/v1/store')))
    expect('email' in body.data).toBe(false)
  })

  it('returns 429 with the fail envelope when rate limited', async () => {
    mockedRateLimited.mockResolvedValueOnce(true)
    const res = await getStore(new Request('http://localhost/api/v1/store'))
    expect(res.status).toBe(429)
    expect(await getJson(res)).toEqual({ success: false, error: 'rate_limited' })
  })
})

describe('GET /api/v1/delivery/nova-poshta/cities', () => {
  it('returns an empty result (not an error) for q shorter than 2 chars', async () => {
    const res = await getCities(new Request('http://localhost/api/v1/delivery/nova-poshta/cities?q=К'))
    expect(res.status).toBe(200)
    expect(await getJson(res)).toEqual({ success: true, data: [] })
    expect(mockedSearchCities).not.toHaveBeenCalled()
  })

  it('returns an empty result when q is missing', async () => {
    const res = await getCities(new Request('http://localhost/api/v1/delivery/nova-poshta/cities'))
    expect(res.status).toBe(200)
    expect(await getJson(res)).toEqual({ success: true, data: [] })
  })

  it('returns the checkout city shape for a valid query', async () => {
    const res = await getCities(
      new Request('http://localhost/api/v1/delivery/nova-poshta/cities?q=Київ'),
    )
    expect(res.status).toBe(200)
    expect(await getJson(res)).toEqual({
      success: true,
      data: [{ ref: 'city-1', name: 'Київ', area: 'Київська', deliveryCityRef: 'dc-1' }],
    })
    expect(mockedSearchCities).toHaveBeenCalledWith('Київ')
  })

  it('returns 429 with the fail envelope when rate limited', async () => {
    mockedRateLimited.mockResolvedValueOnce(true)
    const res = await getCities(new Request('http://localhost/api/v1/delivery/nova-poshta/cities?q=Київ'))
    expect(res.status).toBe(429)
    expect(await getJson(res)).toEqual({ success: false, error: 'rate_limited' })
  })
})

describe('GET /api/v1/delivery/nova-poshta/warehouses', () => {
  it('returns 400 for a missing cityRef', async () => {
    const res = await getWarehouses(new Request('http://localhost/api/v1/delivery/nova-poshta/warehouses'))
    expect(res.status).toBe(400)
    expect(await getJson(res)).toEqual({ success: false, error: 'Невірний cityRef' })
    expect(mockedSearchWarehouses).not.toHaveBeenCalled()
  })

  it.each(['a b', 'a;b', 'a/b', "a'b", 'a.b', 'x'.repeat(101), '-abc'])(
    'returns 400 for invalid cityRef %j',
    async (cityRef) => {
      const res = await getWarehouses(
        new Request(
          `http://localhost/api/v1/delivery/nova-poshta/warehouses?cityRef=${encodeURIComponent(cityRef)}`,
        ),
      )
      expect(res.status).toBe(400)
    },
  )

  it('returns the checkout warehouse shape for a valid cityRef', async () => {
    const res = await getWarehouses(
      new Request(
        'http://localhost/api/v1/delivery/nova-poshta/warehouses?cityRef=db5c88d0-391c-11dd-90d9-001a92567626&q=5',
      ),
    )
    expect(res.status).toBe(200)
    expect(await getJson(res)).toEqual({
      success: true,
      data: [{ ref: 'wh-1', name: 'Відділення №1', number: '1' }],
    })
    expect(mockedSearchWarehouses).toHaveBeenCalledWith(
      'db5c88d0-391c-11dd-90d9-001a92567626',
      '5',
    )
  })

  it('returns 429 with the fail envelope when rate limited', async () => {
    mockedRateLimited.mockResolvedValueOnce(true)
    const res = await getWarehouses(
      new Request('http://localhost/api/v1/delivery/nova-poshta/warehouses?cityRef=abc'),
    )
    expect(res.status).toBe(429)
    expect(await getJson(res)).toEqual({ success: false, error: 'rate_limited' })
  })
})

describe('v1 store/NP routes — structural', () => {
  it('the NP routes never touch the Nova Poshta apiKey', () => {
    expect(source('app/api/v1/delivery/nova-poshta/cities/route.ts')).not.toContain('apiKey')
    expect(source('app/api/v1/delivery/nova-poshta/warehouses/route.ts')).not.toContain('apiKey')
  })

  it('the store route never reads the method config column', () => {
    expect(source('app/api/v1/store/route.ts')).not.toMatch(/\.config\b/)
  })
})
