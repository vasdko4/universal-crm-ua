import { describe, it, expect } from 'vitest'

import { calcBundleTotal } from '@/components/shop/frequently-bought-together'

describe('calcBundleTotal', () => {
  it('sums the selected bundle items', () => {
    expect(calcBundleTotal([{ price: 1000 }, { price: 250 }, { price: 99 }])).toBe(1349)
  })

  it('returns 0 for an empty selection', () => {
    expect(calcBundleTotal([])).toBe(0)
  })

  it('handles a single item', () => {
    expect(calcBundleTotal([{ price: 5499 }])).toBe(5499)
  })
})
