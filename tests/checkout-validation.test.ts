import { describe, it, expect } from 'vitest'
import { validateCheckoutInput, CHECKOUT_LIMITS } from '@/lib/shop/checkout-validation'
import type { CheckoutInput } from '@/app/actions/shop'

function base(overrides: Partial<CheckoutInput> = {}): CheckoutInput {
  return {
    firstName: 'Иван',
    lastName: 'Петренко',
    phone: '+380671234567',
    email: 'ivan@example.com',
    deliveryMethod: 'nova_poshta',
    deliveryCity: 'Київ',
    deliveryBranch: 'Відділення №1',
    paymentMethod: 'cash',
    note: 'позвоните заранее',
    items: [{ productId: 1, quantity: 2 }],
    ...overrides,
  }
}

describe('validateCheckoutInput', () => {
  it('accepts a normal order and passes fields through trimmed', () => {
    const r = validateCheckoutInput(base({ firstName: '  Иван  ' }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.firstName).toBe('Иван')
    expect(r.value.items).toEqual([{ productId: 1, quantity: 2 }])
    expect(r.value.email).toBe('ivan@example.com')
  })

  it('rejects an empty cart', () => {
    expect(validateCheckoutInput(base({ items: [] })).ok).toBe(false)
    expect(validateCheckoutInput({ ...base(), items: undefined as never }).ok).toBe(false)
  })

  it('rejects too many cart lines', () => {
    const items = Array.from({ length: CHECKOUT_LIMITS.maxItems + 1 }, (_, i) => ({
      productId: i + 1,
      quantity: 1,
    }))
    expect(validateCheckoutInput(base({ items })).ok).toBe(false)
  })

  it('rejects NaN / non-numeric / infinite quantities (used to bypass the stock check)', () => {
    for (const quantity of [Number.NaN, 'abc', Infinity, null, {}] as never[]) {
      const r = validateCheckoutInput(base({ items: [{ productId: 1, quantity }] }))
      expect(r.ok).toBe(false)
    }
  })

  it('rejects zero, negative and oversized quantities', () => {
    for (const quantity of [0, -5, CHECKOUT_LIMITS.maxQuantityPerLine + 1]) {
      expect(validateCheckoutInput(base({ items: [{ productId: 1, quantity }] })).ok).toBe(false)
    }
  })

  it('floors fractional quantities instead of rejecting', () => {
    const r = validateCheckoutInput(base({ items: [{ productId: 1, quantity: 2.7 }] }))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.items[0].quantity).toBe(2)
  })

  it('rejects bad product and variant ids', () => {
    expect(validateCheckoutInput(base({ items: [{ productId: Number.NaN, quantity: 1 }] })).ok).toBe(false)
    expect(validateCheckoutInput(base({ items: [{ productId: -1, quantity: 1 }] })).ok).toBe(false)
    expect(
      validateCheckoutInput(base({ items: [{ productId: 1, quantity: 1, variantId: Number.NaN }] })).ok,
    ).toBe(false)
  })

  it('requires a name and a plausible phone', () => {
    expect(validateCheckoutInput(base({ firstName: '  ' })).ok).toBe(false)
    expect(validateCheckoutInput(base({ phone: '12345' })).ok).toBe(false)
    expect(validateCheckoutInput(base({ phone: 'not-a-phone' })).ok).toBe(false)
    expect(validateCheckoutInput(base({ phone: '1'.repeat(40) })).ok).toBe(false)
  })

  it('rejects a malformed email but allows an empty one', () => {
    expect(validateCheckoutInput(base({ email: 'not-an-email' })).ok).toBe(false)
    const r = validateCheckoutInput(base({ email: '' }))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.email).toBeNull()
  })

  it('caps oversized free-text fields instead of storing megabytes', () => {
    const r = validateCheckoutInput(
      base({ note: 'x'.repeat(100_000), deliveryAddress: 'y'.repeat(100_000) }),
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.note!.length).toBe(CHECKOUT_LIMITS.note)
    expect(r.value.deliveryAddress!.length).toBe(CHECKOUT_LIMITS.address)
  })

  it('drops junk cart tokens but keeps valid ones', () => {
    const bad = validateCheckoutInput(base({ cartToken: '<script>alert(1)</script>' }))
    expect(bad.ok && bad.value.cartToken).toBeNull()
    const good = validateCheckoutInput(base({ cartToken: 'abcd1234-efgh5678' }))
    expect(good.ok && good.value.cartToken).toBe('abcd1234-efgh5678')
  })

  it('requires delivery and payment methods', () => {
    expect(validateCheckoutInput(base({ deliveryMethod: '' })).ok).toBe(false)
    expect(validateCheckoutInput(base({ paymentMethod: '' })).ok).toBe(false)
  })
})
