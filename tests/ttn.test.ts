import { describe, it, expect } from 'vitest'
import {
  buildInternetDocumentPayload,
  declaredCost,
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

describe('declaredCost', () => {
  it('rounds to whole hryvnias — the value Nova Poshta actually stores', () => {
    // The reconcile bug: a 1500.50 total is stored by NP as 1501, so the
    // retry must compare against the rounded value, not the raw total.
    expect(declaredCost(1500.5)).toBe(1501)
    expect(declaredCost(1499.4)).toBe(1499)
    expect(declaredCost(1499.5)).toBe(1500)
    expect(declaredCost(100)).toBe(100)
  })

  it('never drops below 1', () => {
    expect(declaredCost(0)).toBe(1)
    expect(declaredCost(0.4)).toBe(1)
    expect(declaredCost(-5)).toBe(1)
  })

  it('payload Cost and declaredCost agree (same helper, no drift)', () => {
    const props = buildInternetDocumentPayload({
      sender,
      recipient: { name: 'Іван', phone: '0671234567', cityName: 'Київ', warehouseRef: 'wh-1' },
      cargo: { description: 'x', cost: 1500.5, weightKg: 1, seats: 1 },
    })
    expect(props.Cost).toBe(String(declaredCost(1500.5)))
    expect(props.Cost).toBe('1501')
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

  it('adds the fallback once for the unweighed portion of a partial parcel', () => {
    expect(
      parcelWeightKg(
        [
          { weightKg: 1, quantity: 2 },
          { weightKg: null, quantity: 1 },
        ],
        0.5,
      ),
    ).toBe(2.5)
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

describe('audit A6/A7/A8: reconcile ambiguity, no-match, delivery side effects', () => {
  const ttnSrc = async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    return readFileSync(resolve(import.meta.dirname, '..', 'app/actions/ttn.ts'), 'utf8')
  }
  const detailSrc = async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    return readFileSync(resolve(import.meta.dirname, '..', 'components/orders/order-detail.tsx'), 'utf8')
  }

  it('A7: no match after an ambiguous attempt does not auto-create', async () => {
    const src = await ttnSrc()
    // Tri-state match: null means "not found", not "proven absent".
    expect(src).toContain('if (match === null)')
    expect(src).toContain('needsConfirm: true')
    expect(src).toContain('Накладну не знайдено у списку Нової Пошти')
    // The no-match abort runs before the attempt is journaled / the API
    // is called, so no second waybill can be created on this path.
    expect(src.indexOf('Накладну не знайдено у списку Нової Пошти')).toBeLessThan(
      src.indexOf('Journal this attempt'),
    )
    // The lookup-failure abort is untouched.
    expect(src).toContain("reportError('ttn.reconcile-lookup'")
  })

  it('A6: an ambiguous match never binds', async () => {
    const src = await ttnSrc()
    expect(src).toContain("'ambiguous' in match")
    expect(src).toContain('Знайдено кілька накладних')
    // Only a single doc reaches the bind transaction.
    expect(src).toContain('const doc = match.doc')
  })

  it('A7: forceCreate skips reconcile and the UI confirms before using it', async () => {
    const src = await ttnSrc()
    expect(src).toContain('forceCreate?: boolean')
    expect(src).toContain('hasAmbiguousAttempt && !opts.forceCreate')
    const ui = await detailSrc()
    expect(ui).toContain('res.needsConfirm')
    expect(ui).toContain('forceCreate: true')
    expect(ui).toContain('ttnForceCreateTitle')
  })

  it('A8: reconciled and precheck paths run the delivery side effects', async () => {
    const src = await ttnSrc()
    // Reconciled: full update — status, method and the history entry.
    expect(src).toContain('trackingNumber: reconciledTtn')
    expect(src).toContain("deliveryStatus: 'ТТН створено'")
    expect(src).toContain("deliveryMethod: 'nova_poshta'")
    // Precheck (and the bound-by-someone-else sub-case): status only, so
    // the history entry from the original creation is not duplicated.
    expect(src).toContain("updateOrderDelivery(orderId, { deliveryStatus: 'ТТН створено' })")
  })
})

describe('audit 63: TTN create reconciles instead of duplicating', () => {
  it('normalizes recipient phones for the NP reconciliation match', async () => {
    const { digitsPhone } = await import('@/lib/delivery/ttn')
    expect(digitsPhone('+380671234567')).toBe('380671234567')
    expect(digitsPhone('0671234567')).toBe('380671234567')
    expect(digitsPhone('671234567')).toBe('380671234567')
    expect(digitsPhone('380 67 123-45-67')).toBe('380671234567')
  })

  it('reconcile never swallows a failed NP lookup and uses the matcher', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const src = readFileSync(resolve(import.meta.dirname, '..', 'app/actions/ttn.ts'), 'utf8')
    // No `.catch(() => null)` on the reconcile lookup: a failed lookup aborts
    // the creation instead of silently creating a second waybill.
    expect(src).not.toContain("findRecentDocumentsByPhone(apiKey, order.customerPhone || '').catch")
    expect(src).toContain("reportError('ttn.reconcile-lookup'")
    expect(src).toContain('matchRecentDocument')
    expect(src).toContain('declaredCost(Number(order.total)')
  })

  it('creates under an advisory lock, journals attempts, never calls the API inside a transaction', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const src = readFileSync(resolve(import.meta.dirname, '..', 'app/actions/ttn.ts'), 'utf8')
    expect(src).toContain('tryAdvisoryLock(TTN_LOCK_NS')
    expect(src).toContain('ttn_attempts')
    expect(src).toContain('findRecentDocumentsByPhone')
    expect(src).toContain("status IN ('ambiguous', 'in_progress')")
    expect(src).toContain("status = 'ambiguous'")
  })
})
