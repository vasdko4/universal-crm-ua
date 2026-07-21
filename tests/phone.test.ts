import { describe, it, expect } from 'vitest'
import { normalizeUaPhone, formatUaPhoneDisplay } from '@/lib/shop/phone'

describe('normalizeUaPhone', () => {
  it('normalizes full international format', () => {
    expect(normalizeUaPhone('+380671234567')).toBe('+380671234567')
    expect(normalizeUaPhone('380671234567')).toBe('+380671234567')
  })

  it('normalizes local formats', () => {
    expect(normalizeUaPhone('0671234567')).toBe('+380671234567')
    expect(normalizeUaPhone('671234567')).toBe('+380671234567')
    expect(normalizeUaPhone('80671234567')).toBe('+380671234567')
  })

  it('handles separators and spaces', () => {
    expect(normalizeUaPhone('+38 (067) 123-45-67')).toBe('+380671234567')
    expect(normalizeUaPhone('067 123 45 67')).toBe('+380671234567')
  })

  it('rejects invalid numbers', () => {
    expect(normalizeUaPhone('12345')).toBeNull()
    expect(normalizeUaPhone('')).toBeNull()
    expect(normalizeUaPhone('abc')).toBeNull()
  })
})

describe('formatUaPhoneDisplay', () => {
  it('formats a normalized phone', () => {
    expect(formatUaPhoneDisplay('0671234567')).toBe('+380 (67) 123-45-67')
  })

  it('returns input unchanged when not parseable', () => {
    expect(formatUaPhoneDisplay('n/a')).toBe('n/a')
  })
})
