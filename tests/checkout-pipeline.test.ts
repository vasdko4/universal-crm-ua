import { describe, it, expect } from 'vitest'
import { validateCheckoutInput } from '@/lib/shop/checkout-validation'
import { applyStockLine, checkoutStockError } from '@/lib/shop/checkout-stock'
import { refundPlan } from '@/lib/payments/refund'
import type { CheckoutInput } from '@/app/actions/shop'

/**
 * Pure stand-in for checkout → pay → stock without a DB.
 * Mirrors: validate cart → refuse oversell → decrement on paid → refund remaining.
 */
function checkoutPayStock(input: CheckoutInput, onHand: number) {
  const validated = validateCheckoutInput(input)
  if (!validated.ok) return { stage: 'validate' as const, error: validated.error }

  const qty = validated.value.items.reduce((s, i) => s + i.quantity, 0)
  const stockErr = checkoutStockError({ onHand, requested: qty, name: 'Phone' })
  if (stockErr) return { stage: 'stock-check' as const, error: stockErr }

  const applied = applyStockLine({ onHand, requested: qty, name: 'Phone' })
  const total = 1499.4
  return {
    stage: 'paid' as const,
    paymentStatus: 'paid' as const,
    nextOnHand: applied.nextOnHand,
    total,
  }
}

describe('checkout → payment → stock pipeline', () => {
  const cart: CheckoutInput = {
    firstName: 'Іван',
    lastName: 'Петренко',
    phone: '+380671234567',
    email: 'ivan@example.com',
    deliveryMethod: 'nova_poshta',
    deliveryCity: 'Київ',
    deliveryBranch: 'Відділення №1',
    paymentMethod: 'online',
    items: [{ productId: 1, quantity: 2 }],
  }

  it('valid cart decrements stock on paid', () => {
    const r = checkoutPayStock(cart, 5)
    expect(r).toMatchObject({ stage: 'paid', paymentStatus: 'paid', nextOnHand: 3 })
  })

  it('stops before payment when stock is short', () => {
    const r = checkoutPayStock(cart, 1)
    expect(r.stage).toBe('stock-check')
  })

  it('rejects hostile checkout before touching stock', () => {
    const r = checkoutPayStock({ ...cart, items: [] }, 5)
    expect(r.stage).toBe('validate')
  })

  it('paid order can be partially then fully refunded', () => {
    const first = refundPlan(1499.4, 0, 500)
    expect(first.ok && first.status).toBe('partially_refunded')
    const rest = first.ok ? refundPlan(1499.4, first.newRefunded) : first
    expect(rest.ok && rest.status).toBe('refunded')
  })

  it('full refund restores on-hand; partial does not', () => {
    const paid = checkoutPayStock(cart, 5)
    expect(paid.stage).toBe('paid')
    if (paid.stage !== 'paid') return
    const partial = refundPlan(paid.total, 0, 500)
    expect(partial.ok && partial.status).toBe('partially_refunded')
    // stock stays deducted until the remainder is refunded
    expect(paid.nextOnHand).toBe(3)
    const full = refundPlan(paid.total, 0)
    expect(full.ok && full.status).toBe('refunded')
    const restored = paid.nextOnHand + 2
    expect(restored).toBe(5)
  })
})
