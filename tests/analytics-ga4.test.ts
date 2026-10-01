import { describe, it, expect } from 'vitest'
import { buildGa4PurchasePayload, readGa4Creds } from '@/lib/analytics/ga4'

describe('readGa4Creds', () => {
  it('returns null when either credential is missing — the sender is a no-op', () => {
    expect(readGa4Creds({})).toBeNull()
    expect(readGa4Creds({ GA4_MEASUREMENT_ID: 'G-123' })).toBeNull()
    expect(readGa4Creds({ GA4_API_SECRET: 'secret' })).toBeNull()
    expect(readGa4Creds({ GA4_MEASUREMENT_ID: '  ', GA4_API_SECRET: 'secret' })).toBeNull()
  })

  it('returns trimmed credentials when both are set', () => {
    expect(readGa4Creds({ GA4_MEASUREMENT_ID: ' G-123 ', GA4_API_SECRET: 'secret' })).toEqual({
      measurementId: 'G-123',
      apiSecret: 'secret',
    })
  })
})

describe('buildGa4PurchasePayload', () => {
  it('builds a Measurement Protocol purchase event', () => {
    const payload = buildGa4PurchasePayload({
      clientId: 'order-123',
      transactionId: '100500',
      value: 1999.9,
      currency: 'UAH',
      items: [
        { itemId: 'SKU-1', itemName: 'Ноутбук', quantity: 1, price: 1999.9 },
        { itemId: 'SKU-2', itemName: 'Миша', quantity: 2, price: 250 },
      ],
    })
    expect(payload).toEqual({
      client_id: 'order-123',
      events: [
        {
          name: 'purchase',
          params: {
            transaction_id: '100500',
            value: 1999.9,
            currency: 'UAH',
            items: [
              { item_id: 'SKU-1', item_name: 'Ноутбук', quantity: 1, price: 1999.9 },
              { item_id: 'SKU-2', item_name: 'Миша', quantity: 2, price: 250 },
            ],
          },
        },
      ],
    })
  })

  it('rounds money to 2 decimals and clamps quantity to at least 1', () => {
    const payload = buildGa4PurchasePayload({
      clientId: 'order-1',
      transactionId: '1',
      value: 10.005,
      currency: '',
      items: [{ itemId: 'x', itemName: 'y', quantity: 0, price: 10.005 }],
    })
    const params = (payload.events as Array<{ params: Record<string, unknown> }>)[0].params
    expect(params.value).toBe(10.01)
    expect(params.currency).toBe('UAH')
    const items = params.items as Array<{ quantity: number; price: number }>
    expect(items[0].quantity).toBe(1)
    expect(items[0].price).toBe(10.01)
  })
})
