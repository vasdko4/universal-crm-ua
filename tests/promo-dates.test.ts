import { describe, it, expect } from 'vitest'
import { kyivDayBoundary } from '@/lib/shop/promo-dates'

// Kyiv is UTC+2 in winter, UTC+3 in summer (DST). The helper must map a
// YYYY-MM-DD date to 00:00:00 / 23:59:59 Kyiv wall time, regardless of the
// server timezone. (REGRESSION: the old code used UTC midnight, shifting
// promo windows by 2-3 hours.)
describe('kyivDayBoundary', () => {
  it('maps start-of-day to 00:00 Kyiv in winter (UTC+2)', () => {
    const d = kyivDayBoundary('2026-01-15', false)
    expect(d.toISOString()).toBe('2026-01-14T22:00:00.000Z')
  })

  it('maps end-of-day to 23:59:59 Kyiv in winter (UTC+2)', () => {
    const d = kyivDayBoundary('2026-01-15', true)
    expect(d.toISOString()).toBe('2026-01-15T21:59:59.000Z')
  })

  it('maps start-of-day to 00:00 Kyiv in summer (UTC+3)', () => {
    const d = kyivDayBoundary('2026-07-15', false)
    expect(d.toISOString()).toBe('2026-07-14T21:00:00.000Z')
  })

  it('maps end-of-day to 23:59:59 Kyiv in summer (UTC+3)', () => {
    const d = kyivDayBoundary('2026-07-15', true)
    expect(d.toISOString()).toBe('2026-07-15T20:59:59.000Z')
  })

  it('is consistent across the DST transition weekend', () => {
    // 2026-03-29: clocks go forward in Kyiv (02:00 -> 03:00)
    const before = kyivDayBoundary('2026-03-28', false)
    const after = kyivDayBoundary('2026-03-30', false)
    expect(before.toISOString()).toBe('2026-03-27T22:00:00.000Z') // UTC+2
    expect(after.toISOString()).toBe('2026-03-29T21:00:00.000Z') // UTC+3
    // Both represent 00:00 Kyiv wall time on their respective dates
    expect(after.getTime() - before.getTime()).toBe(2 * 24 * 3600 * 1000 - 3600 * 1000)
  })
})
