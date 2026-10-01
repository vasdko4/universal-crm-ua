import { describe, it, expect } from 'vitest'
import { initials, formatKyivDate } from '@/components/shop/account/utils'

describe('initials', () => {
  it('takes first letters of the first two name parts', () => {
    expect(initials('Іван Петров', 'x@y.z')).toBe('ІП')
  })

  it('takes two letters from a single name part', () => {
    expect(initials('Іван', 'x@y.z')).toBe('ІВ')
  })

  it('falls back to the email local part when the name is empty', () => {
    expect(initials('  ', 'john@example.com')).toBe('JO')
  })
})

describe('formatKyivDate', () => {
  it('uses Europe/Kyiv timezone, not UTC', () => {
    // 2026-09-30T22:30:00Z is still Sep 30 in UTC but already Oct 1 in Kyiv (UTC+3).
    const kyiv = formatKyivDate('2026-09-30T22:30:00Z', 'uk')
    const utc = new Date('2026-09-30T22:30:00Z').toLocaleDateString('uk-UA', {
      timeZone: 'UTC',
    })
    expect(kyiv).not.toBe(utc)
  })

  it('is stable within one Kyiv calendar day', () => {
    expect(formatKyivDate('2026-10-01T10:00:00Z', 'uk')).toBe(
      formatKyivDate('2026-10-01T20:00:00Z', 'uk'),
    )
    expect(formatKyivDate('2026-09-30T20:30:00Z', 'uk')).not.toBe(
      formatKyivDate('2026-09-30T21:30:00Z', 'uk'),
    )
  })

  it('returns an empty string for null', () => {
    expect(formatKyivDate(null, 'uk')).toBe('')
  })
})
