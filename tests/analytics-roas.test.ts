import { describe, it, expect } from 'vitest'
import { calcRoas, mergeSpendIntoReport, validateSpendEntries, spendKey, DIRECT_SOURCE_SENTINEL } from '@/lib/analytics/roas'
import { normalizeAdsSpend } from '@/lib/store-settings-normalize'

describe('calcRoas', () => {
  it('divides revenue by spend', () => {
    expect(calcRoas(5000, 1000)).toBe(5)
    expect(calcRoas(333, 100)).toBeCloseTo(3.33, 2)
  })

  it('returns null instead of Infinity when spend is missing or zero', () => {
    expect(calcRoas(5000, null)).toBeNull()
    expect(calcRoas(5000, 0)).toBeNull()
    expect(calcRoas(5000, -10)).toBeNull()
    expect(calcRoas(5000, Number.NaN)).toBeNull()
  })

  it('returns null for non-finite or negative revenue', () => {
    expect(calcRoas(Number.NaN, 100)).toBeNull()
    expect(calcRoas(-5, 100)).toBeNull()
  })
})

describe('spendKey', () => {
  it('distinguishes triples that differ in any field', () => {
    expect(spendKey('google', 'cpc', 'a')).not.toBe(spendKey('google', 'cpc', 'b'))
    expect(spendKey('google', 'cpc', 'a')).not.toBe(spendKey('meta', 'cpc', 'a'))
    // Same key for the direct-traffic sentinel the SQL query emits.
    expect(spendKey(DIRECT_SOURCE_SENTINEL, '', '')).toBe(spendKey('(direct)', '', ''))
  })
})

describe('mergeSpendIntoReport', () => {
  const rows = [
    { source: 'google', medium: 'cpc', campaign: 'summer', orders: 10, revenue: 20000 },
    { source: '(direct)', medium: '', campaign: '', orders: 5, revenue: 8000 },
  ]

  it('joins spend by the (source, medium, campaign) triple', () => {
    const merged = mergeSpendIntoReport(rows, [
      { source: 'google', medium: 'cpc', campaign: 'summer', spend: 4000 },
    ])
    expect(merged[0].spend).toBe(4000)
    expect(merged[0].roas).toBe(5)
    expect(merged[1].spend).toBeNull()
    expect(merged[1].roas).toBeNull()
  })

  it('ignores invalid spend entries instead of poisoning the report', () => {
    const merged = mergeSpendIntoReport(rows, [
      { source: 'google', medium: 'cpc', campaign: 'summer', spend: Number.NaN },
      { source: 'google', medium: 'cpc', campaign: 'summer', spend: -50 },
    ])
    expect(merged[0].spend).toBeNull()
    expect(merged[0].roas).toBeNull()
  })
})

describe('validateSpendEntries', () => {
  it('accepts a well-formed payload and rounds to 2 decimals', () => {
    const out = validateSpendEntries([
      { source: 'google', medium: 'cpc', campaign: 'summer', spend: 1234.567 },
    ])
    expect(out).toEqual([{ source: 'google', medium: 'cpc', campaign: 'summer', spend: 1234.57 }])
  })

  it('drops rows with empty source, NaN or negative spend', () => {
    const out = validateSpendEntries([
      { source: '', medium: 'cpc', campaign: 'x', spend: 100 },
      { source: 'google', medium: 'cpc', campaign: 'y', spend: Number.NaN },
      { source: 'google', medium: 'cpc', campaign: 'z', spend: -1 },
      { source: 'google', medium: 'cpc', campaign: 'ok', spend: 10 },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].campaign).toBe('ok')
  })

  it('collapses duplicate keys, last write wins', () => {
    const out = validateSpendEntries([
      { source: 'google', medium: 'cpc', campaign: 'summer', spend: 100 },
      { source: 'google', medium: 'cpc', campaign: 'summer', spend: 200 },
    ])
    expect(out).toEqual([{ source: 'google', medium: 'cpc', campaign: 'summer', spend: 200 }])
  })

  it('accepts spend given as a numeric string (form input)', () => {
    const out = validateSpendEntries([{ source: 'meta', medium: '', campaign: '', spend: '250.5' }])
    expect(out[0].spend).toBe(250.5)
  })

  it('returns [] for a non-array payload', () => {
    expect(validateSpendEntries(null)).toEqual([])
    expect(validateSpendEntries({})).toEqual([])
  })
})

describe('normalizeAdsSpend', () => {
  it('normalizes the stored setting and drops garbage', () => {
    const out = normalizeAdsSpend({
      entries: [
        { source: 'google', medium: 'cpc', campaign: 'summer', spend: 100 },
        { source: '', medium: '', campaign: '', spend: 50 },
        'garbage',
      ],
    })
    expect(out.entries).toEqual([{ source: 'google', medium: 'cpc', campaign: 'summer', spend: 100 }])
  })

  it('degrades unknown shapes to the empty default', () => {
    expect(normalizeAdsSpend(undefined)).toEqual({ entries: [] })
    expect(normalizeAdsSpend(null)).toEqual({ entries: [] })
    expect(normalizeAdsSpend({})).toEqual({ entries: [] })
    expect(normalizeAdsSpend('nope')).toEqual({ entries: [] })
  })
})
