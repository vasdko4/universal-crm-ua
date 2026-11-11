import { describe, it, expect } from 'vitest'
import { InsufficientStockError } from '@/lib/shop/order-fulfillment'

describe('InsufficientStockError', () => {
  it('carries the oversold items and formats a readable message', () => {
    const err = new InsufficientStockError([
      { name: 'Phone', variantLabel: 'Black', requested: 2 },
      { name: 'Case', variantLabel: null, requested: 1 },
    ])
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('InsufficientStockError')
    expect(err.items).toHaveLength(2)
    expect(err.message).toContain('«Phone» (Black) × 2')
    expect(err.message).toContain('«Case» × 1')
  })
})

describe('audit 24: finalizePaidOrder claims and fulfills in one transaction', () => {
  it('runs the claim and the fulfillment on the same client, notifies after commit', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const src = readFileSync(resolve(import.meta.dirname, '..', 'lib/shop/order-fulfillment.ts'), 'utf8')
    // 3.4.87: the claim+fulfill half moved into claimAndFulfillPaidOrder; the
    // no-client path owns the connection as `owned` now.
    expect(src).toContain("await owned.query('BEGIN')")
    // 3.4.93 (A1): finalize passes strictPromo: false — a missed promo
    // increment is logged, never throws the paid order back to pending_payment.
    expect(src).toContain('await applyOrderFulfillment(orderId, client, { strictPromo: false })')
    expect(src).toContain("await owned.query('COMMIT')")
    expect(src).toContain("await owned.query('ROLLBACK')")
    // The notification stays outside the transaction, after commit.
    const notifyAt = src.indexOf('notifyNewOrder(orderId)')
    const commitAt = src.indexOf("await owned.query('COMMIT')")
    expect(notifyAt).toBeGreaterThan(commitAt)
  })
})
