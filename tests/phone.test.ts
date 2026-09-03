import { describe, it, expect } from 'vitest'
import { normalizeUaPhone, formatUaPhoneDisplay, formatUaPhoneInput } from '@/lib/shop/phone'

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

describe('formatUaPhoneInput', () => {
  it('keeps the +380 prefix while typing', () => {
    expect(formatUaPhoneInput('+380')).toBe('+380')
    expect(formatUaPhoneInput('+380 6')).toBe('+380 6')
    expect(formatUaPhoneInput('+380 67 123 45 67')).toBe('+380 67 123 45 67')
  })

  it('normalizes pasted local and international numbers', () => {
    expect(formatUaPhoneInput('0671234567')).toBe('+380 67 123 45 67')
    expect(formatUaPhoneInput('380671234567')).toBe('+380 67 123 45 67')
    expect(formatUaPhoneInput('+38 (067) 123-45-67')).toBe('+380 67 123 45 67')
  })

  it('caps at 9 national digits', () => {
    expect(formatUaPhoneInput('06712345678999')).toBe('+380 67 123 45 67')
  })
})
