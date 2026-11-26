import { describe, it, expect } from 'vitest'
import {
  filterLivePromotions,
  isPromotionLiveNow,
  type ActivePromotion,
} from '@/lib/shop/queries'

// Fixed "now" for every case: 2026-11-27T12:00:00.000Z.
const NOW = new Date('2026-11-27T12:00:00.000Z')

function promo(overrides: Partial<ActivePromotion> = {}): ActivePromotion {
  return {
    id: 1,
    name: 'Test promo',
    discountType: 'percentage',
    discountValue: 10,
    targetType: 'all',
    targetGroupIds: [],
    targetProductIds: [],
    startsAt: '2026-11-01T00:00:00.000Z',
    endsAt: '2026-12-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('isPromotionLiveNow', () => {
  it('returns true for a promo that started and has not ended yet', () => {
    expect(isPromotionLiveNow(promo(), NOW)).toBe(true)
  })

  it('returns false for a promo that already ended', () => {
    expect(
      isPromotionLiveNow(promo({ endsAt: '2026-11-20T00:00:00.000Z' }), NOW),
    ).toBe(false)
  })

  it('returns false for a promo that has not started yet', () => {
    expect(
      isPromotionLiveNow(promo({ startsAt: '2026-12-01T00:00:00.000Z' }), NOW),
    ).toBe(false)
  })

  it('returns true for an open-ended promo (null endsAt) that already started', () => {
    expect(isPromotionLiveNow(promo({ endsAt: null }), NOW)).toBe(true)
  })

  it('returns false for an open-ended promo (null endsAt) that has not started yet', () => {
    expect(
      isPromotionLiveNow(
        promo({ startsAt: '2026-12-01T00:00:00.000Z', endsAt: null }),
        NOW,
      ),
    ).toBe(false)
  })

  it('returns false when now is exactly the end time (boundary: endsAt is exclusive)', () => {
    expect(
      isPromotionLiveNow(promo({ endsAt: '2026-11-27T12:00:00.000Z' }), NOW),
    ).toBe(false)
  })

  it('returns true when now is exactly the start time (boundary: startsAt is inclusive)', () => {
    expect(
      isPromotionLiveNow(promo({ startsAt: '2026-11-27T12:00:00.000Z' }), NOW),
    ).toBe(true)
  })

  it('returns false when the promo ended one millisecond before now', () => {
    expect(
      isPromotionLiveNow(promo({ endsAt: '2026-11-27T11:59:59.999Z' }), NOW),
    ).toBe(false)
  })

  it('returns false when the promo starts one millisecond after now', () => {
    expect(
      isPromotionLiveNow(promo({ startsAt: '2026-11-27T12:00:00.001Z' }), NOW),
    ).toBe(false)
  })
})

describe('filterLivePromotions', () => {
  it('keeps only the live promos from a mixed list', () => {
    const live = promo({ id: 1 })
    const expired = promo({ id: 2, endsAt: '2026-11-20T00:00:00.000Z' })
    const future = promo({ id: 3, startsAt: '2026-12-01T00:00:00.000Z' })
    const openEnded = promo({ id: 4, endsAt: null })
    expect(filterLivePromotions([live, expired, future, openEnded], NOW)).toEqual([
      live,
      openEnded,
    ])
  })

  it('returns an empty array when every promo has expired', () => {
    const expired = promo({ id: 1, endsAt: '2026-11-20T00:00:00.000Z' })
    expect(filterLivePromotions([expired], NOW)).toEqual([])
  })

  it('returns an empty array for empty input', () => {
    expect(filterLivePromotions([], NOW)).toEqual([])
  })

  it('returns every promo when all of them are live, in order', () => {
    const first = promo({ id: 1 })
    const second = promo({ id: 2, endsAt: null })
    expect(filterLivePromotions([first, second], NOW)).toEqual([first, second])
  })

  it('drops a promo ending exactly at now', () => {
    const endingNow = promo({ id: 1, endsAt: '2026-11-27T12:00:00.000Z' })
    expect(filterLivePromotions([endingNow], NOW)).toEqual([])
  })

  it('keeps an open-ended promo that already started', () => {
    const openEnded = promo({ id: 1, endsAt: null })
    expect(filterLivePromotions([openEnded], NOW)).toEqual([openEnded])
  })

  it('does not mutate the input array', () => {
    const live = promo({ id: 1 })
    const expired = promo({ id: 2, endsAt: '2026-11-20T00:00:00.000Z' })
    const input = [live, expired]
    const result = filterLivePromotions(input, NOW)
    expect(result).toEqual([live])
    expect(input).toEqual([live, expired])
  })

  it('keeps a promo starting exactly at now', () => {
    const startingNow = promo({ id: 1, startsAt: '2026-11-27T12:00:00.000Z' })
    expect(filterLivePromotions([startingNow], NOW)).toEqual([startingNow])
  })
})
