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
