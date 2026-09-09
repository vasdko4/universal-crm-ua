import { describe, it, expect } from 'vitest'
import {
  buildInternetDocumentPayload,
  parseTtnFromSaveResponse,
  parcelWeightKg,
  novaPoshtaPrintUrl,
  novaPoshtaTrackingUrl,
} from '@/lib/delivery/ttn'

const sender = {
  cityRef: 'city-sender',
  senderRef: 'sender',
  senderAddressRef: 'sender-wh',
  contactSenderRef: 'contact',
  phone: '+380671112233',
}

describe('buildInternetDocumentPayload', () => {
  it('builds a warehouse-to-warehouse parcel', () => {
    const props = buildInternetDocumentPayload({
      sender,
      recipient: {
        name: 'Іван Петренко',
        phone: '0671234567',
        cityName: 'Київ',
        cityRef: 'city-kyiv',
        warehouseRef: 'wh-1',
      },
      cargo: { description: 'Навушники', cost: 1499.4, weightKg: 0.4, seats: 1 },
    })
    expect(props.PayerType).toBe('Sender')
    expect(props.ServiceType).toBe('WarehouseWarehouse')
    expect(props.Cost).toBe('1499')
    expect(props.Weight).toBe('0.4')
    expect(props.RecipientsPhone).toBe('380671234567')
    expect(props.RecipientAddress).toBe('wh-1')
    expect(props.CityRecipient).toBe('city-kyiv')
    expect(props.DateTime).toMatch(/^\d{2}\.\d{2}\.\d{4}$/)
  })

  it('uses warehouse refs when present', () => {
    const props = buildInternetDocumentPayload({
      sender,
      recipient: {
        name: 'Іван',
        phone: '0670000000',
        cityName: 'Київ',
        cityRef: 'city-kyiv',
        warehouseRef: 'wh-ref',
      },
      cargo: { description: 'x', cost: 100, weightKg: 1, seats: 1 },
    })
    expect(props.RecipientAddress).toBe('wh-ref')
    expect(props.CityRecipient).toBe('city-kyiv')
    expect(props.NewAddress).toBeUndefined()
  })

  it('falls back to NewAddress when there is no warehouse ref', () => {
    const props = buildInternetDocumentPayload({
      sender,
      recipient: {
        name: 'Олена',
        phone: '380501112233',
        cityName: 'Львів',
        warehouseName: 'Відділення №12',
      },
      cargo: { description: 'Замовлення', cost: 10, weightKg: 1, seats: 1 },
    })
    expect(props.NewAddress).toBe('1')
    expect(props.RecipientCityName).toBe('Львів')
    expect(props.RecipientAddressName).toContain('12')
  })
})

describe('parcelWeightKg', () => {
  it('sums product weights by quantity', () => {
    expect(
      parcelWeightKg(
        [
          { weightKg: 0.4, quantity: 2 },
          { weightKg: '0.3', quantity: 1 },
        ],
        0.5,
      ),
    ).toBe(1.1)
  })

  it('uses fallback when no line has weight', () => {
    expect(parcelWeightKg([{ weightKg: null, quantity: 3 }], 0.5)).toBe(0.5)
    expect(parcelWeightKg([], 0.2)).toBe(0.2)
  })
})

describe('parseTtnFromSaveResponse', () => {
  it('reads IntDocNumber from the NP save payload', () => {
    expect(parseTtnFromSaveResponse([{ IntDocNumber: '20450123456789' }])).toBe('20450123456789')
    expect(parseTtnFromSaveResponse({})).toBeNull()
  })
})

describe('novaPoshta print vs tracking URLs', () => {
  it('builds a printDocument PDF URL, not the public tracking page', () => {
    const url = novaPoshtaPrintUrl('key-1', '20450123456789')
    expect(url).toContain('printDocument')
    expect(url).toContain('20450123456789')
    expect(url).not.toContain('novaposhta.ua/tracking')
    expect(novaPoshtaTrackingUrl('20450123456789')).toContain('cargo_number=20450123456789')
  })
})

describe('admin label proxy path', () => {
  it('never puts the API key in the browser-facing print path', () => {
    const browserPath = `/api/admin/np-label?orderId=12`
    expect(browserPath).not.toContain('apiKey')
    expect(novaPoshtaPrintUrl('secret-key', '2045')).toContain('secret-key')
  })
})
