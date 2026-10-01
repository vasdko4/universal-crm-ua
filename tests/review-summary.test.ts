import { describe, expect, it } from 'vitest'
import { summarizeReviews } from '@/lib/shop/review-summary'

describe('summarizeReviews', () => {
  it('returns zero count and zero average for an empty list', () => {
    expect(summarizeReviews([])).toEqual({ count: 0, avg: 0 })
  })

  it('counts every review exactly once — the list and the counter cannot disagree', () => {
    const reviews = [{ rating: 5 }, { rating: 4 }, { rating: 3 }]
    expect(summarizeReviews(reviews)).toEqual({ count: 3, avg: 4 })
  })

  it('handles a single review', () => {
    expect(summarizeReviews([{ rating: 2 }])).toEqual({ count: 1, avg: 2 })
  })

  it('computes a fractional average', () => {
    const { count, avg } = summarizeReviews([{ rating: 5 }, { rating: 4 }])
    expect(count).toBe(2)
    expect(avg).toBeCloseTo(4.5, 10)
  })

  it('treats missing ratings as zero instead of NaN', () => {
    const { count, avg } = summarizeReviews([{ rating: null }, { rating: 4 }])
    expect(count).toBe(2)
    expect(avg).toBeCloseTo(2, 10)
  })
})
