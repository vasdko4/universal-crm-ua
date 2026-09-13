import { describe, it, expect } from 'vitest'
import { formatPrice } from '@/lib/shop/format'

describe('formatPrice', () => {
  it('formats UAH by default', () => {
    expect(formatPrice(1500)).toBe('1 500 ₴')
  })

  it('rounds fractional values', () => {
    expect(formatPrice(999.6)).toBe('1 000 ₴')
    expect(formatPrice(999.4)).toBe('999 ₴')
  })

  it('supports other currencies', () => {
    expect(formatPrice(10, 'USD')).toBe('10 $')
    expect(formatPrice(10, 'EUR')).toBe('10 €')
  })

  it('falls back to the raw currency code', () => {
    expect(formatPrice(5, 'PLN')).toBe('5 PLN')
  })

  it('uses ru-RU grouping when locale is ru', () => {
    expect(formatPrice(1500, 'UAH', 'ru')).toBe('1 500 ₴')
    expect(formatPrice(1500, 'UAH', 'uk')).toBe('1 500 ₴')
  })
})
