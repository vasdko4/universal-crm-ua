import { describe, it, expect } from 'vitest'
import {
  validateOneClickInput,
  resolveOneClickLine,
  createOneClickGuard,
  ONE_CLICK_LIMITS,
  type OneClickProductRow,
  type OneClickVariantRow,
} from '@/lib/shop/one-click'

function product(overrides: Partial<OneClickProductRow> = {}): OneClickProductRow {
  return {
    id: 7,
    name: 'Тестовий товар',
    price: '1234.50',
    costPrice: '1000.00',
    sku: 'TST-1',
    image: null,
    quantity: 10,
    inStock: true,
    variantsEnabled: false,
    ...overrides,
  }
}

function variant(overrides: Partial<OneClickVariantRow> = {}): OneClickVariantRow {
  return {
    id: 42,
    productId: 7,
    price: '1500.00',
    quantity: 3,
    isInStock: true,
    sku: 'TST-1-M',
    image: null,
    options: { Розмір: 'M' },
    ...overrides,
  }
}

describe('validateOneClickInput', () => {
  it('accepts a valid payload: trims the name, normalizes the phone like the checkout', () => {
    const r = validateOneClickInput({ productId: 7, name: '  Олена  ', phone: '0671234567' }, 'uk')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.name).toBe('Олена')
    // Same rule as checkout-flow's phone validator (lib/shop/phone.ts).
    expect(r.value.phone).toBe('+380671234567')
    expect(r.value.productId).toBe(7)
    expect(r.value.variantId).toBeUndefined()
  })

  it('rejects an empty name', () => {
    expect(validateOneClickInput({ productId: 7, name: '   ', phone: '0671234567' }).ok).toBe(false)
  })

  it('caps the name instead of rejecting', () => {
    const r = validateOneClickInput({ productId: 7, name: 'А'.repeat(200), phone: '0671234567' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.name.length).toBe(ONE_CLICK_LIMITS.name)
  })

  it('rejects non-UA / too-short phones exactly like the checkout validator', () => {
    for (const phone of ['', '123', '+15551234567', 'not-a-phone', '+380 (67) 123-45']) {
      expect(validateOneClickInput({ productId: 7, name: 'Олена', phone }).ok).toBe(false)
    }
  })

  it('rejects hostile product ids (NaN, zero, negative, non-integer)', () => {
    for (const productId of [Number.NaN, 0, -3, 1.5, '7', null]) {
      expect(validateOneClickInput({ productId, name: 'Олена', phone: '0671234567' }).ok).toBe(false)
    }
  })

  it('accepts an explicit variant id, rejects a hostile one', () => {
    expect(
      validateOneClickInput({ productId: 7, variantId: 42, name: 'Олена', phone: '0671234567' }).ok,
    ).toBe(true)
    expect(
      validateOneClickInput({ productId: 7, variantId: Number.NaN, name: 'Олена', phone: '0671234567' })
        .ok,
    ).toBe(false)
  })
})

describe('resolveOneClickLine', () => {
  it('uses the product price for a plain product', () => {
    const r = resolveOneClickLine(product(), null)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.line.price).toBe(1234.5)
    expect(r.line.variantId).toBeNull()
    expect(r.line.quantity).toBe(1)
    expect(r.line.costPrice).toBe(1000)
  })

  it('uses the variant price and label when variants are enabled', () => {
    const r = resolveOneClickLine(product({ variantsEnabled: true }), variant())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.line.price).toBe(1500)
    expect(r.line.variantId).toBe(42)
    expect(r.line.variantLabel).toBe('Розмір: M')
    expect(r.line.sku).toBe('TST-1-M')
  })

  it('ignores the variant when the product has variants disabled', () => {
    const r = resolveOneClickLine(product(), variant())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.line.price).toBe(1234.5)
    expect(r.line.variantId).toBeNull()
  })

  it('rejects a variant that belongs to another product', () => {
    const r = resolveOneClickLine(product({ variantsEnabled: true }), variant({ productId: 999 }))
    expect(r.ok).toBe(false)
  })

  it('rejects out-of-stock variants and products', () => {
    expect(
      resolveOneClickLine(product({ variantsEnabled: true }), variant({ quantity: 0 })).ok,
    ).toBe(false)
    expect(
      resolveOneClickLine(product({ variantsEnabled: true }), variant({ isInStock: false })).ok,
    ).toBe(false)
    expect(resolveOneClickLine(product({ quantity: 0, inStock: false }), null).ok).toBe(false)
  })
})

describe('createOneClickGuard (double-click idempotency)', () => {
  it('lets the first submit through and blocks the second while in flight', () => {
    const guard = createOneClickGuard()
    expect(guard.start()).toBe(true)
    expect(guard.inFlight).toBe(true)
    // The repeat click is rejected — one tap can never create two orders.
    expect(guard.start()).toBe(false)
  })

  it('allows submitting again after the guard is reset', () => {
    const guard = createOneClickGuard()
    guard.start()
    guard.reset()
    expect(guard.inFlight).toBe(false)
    expect(guard.start()).toBe(true)
  })

  it('guards are independent per instance', () => {
    const a = createOneClickGuard()
    const b = createOneClickGuard()
    a.start()
    expect(b.start()).toBe(true)
  })
})
