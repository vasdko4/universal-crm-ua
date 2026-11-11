import { describe, it, expect } from 'vitest'
import { matchRecentDocument, parseNpDateTime, type NpRecentDocument } from '@/lib/delivery/nova-poshta'
import { declaredCost } from '@/lib/delivery/ttn'

function doc(over: Partial<NpRecentDocument> & { ttn: string }): NpRecentDocument {
  return { phone: '380671234567', cost: 1501, dateTime: '11.11.2026 10:00:00', ...over }
}

describe('matchRecentDocument (audit 63 reconcile)', () => {
  it('matches the rounded declared value, not the raw total with kopecks', () => {
    const docs = [doc({ ttn: '20450000000001', cost: 1501 })]
    // Order total 1500.50 is stored by NP as 1501.
    expect(matchRecentDocument(docs, { declaredCost: declaredCost(1500.5), phone: '0671234567' })?.doc?.ttn).toBe(
      '20450000000001',
    )
    // The raw total must NOT match: 1500.50 vs stored 1501 differs by 0.50.
    expect(matchRecentDocument(docs, { declaredCost: 1500.5, phone: '0671234567' })).toBeNull()
    expect(matchRecentDocument([doc({ ttn: 'x', cost: 1500 })], { declaredCost: 1501, phone: '0671234567' })).toBeNull()
  })

  it('tolerates float noise only, not real differences', () => {
    const docs = [doc({ ttn: '20450000000001', cost: 1501.005 })]
    expect(matchRecentDocument(docs, { declaredCost: 1501, phone: '0671234567' })?.doc?.ttn).toBe('20450000000001')
    expect(matchRecentDocument([doc({ ttn: 'x', cost: 1501.5 })], { declaredCost: 1501, phone: '0671234567' })).toBeNull()
  })

  it('matches every phone format against the 380… form NP stores', () => {
    const docs = [doc({ ttn: '20450000000001' })]
    for (const phone of ['0671234567', '+380671234567', '380671234567', '380 67 123-45-67', '671234567']) {
      expect(matchRecentDocument(docs, { declaredCost: 1501, phone })?.doc?.ttn).toBe('20450000000001')
    }
    // A different subscriber never matches, even with the same declared value.
    expect(matchRecentDocument(docs, { declaredCost: 1501, phone: '0679999999' })).toBeNull()
  })

  it('never binds a stranger’s waybill (phone or cost must agree)', () => {
    const docs = [
      doc({ ttn: '20450000000001', phone: '380501112233', cost: 1501 }),
      doc({ ttn: '20450000000002', phone: '380671234567', cost: 999 }),
    ]
    expect(matchRecentDocument(docs, { declaredCost: 1501, phone: '0671234567' })).toBeNull()
  })

  it('ignores documents without a cost and returns null for an empty list', () => {
    expect(matchRecentDocument([doc({ ttn: 'x', cost: null })], { declaredCost: 1501, phone: '0671234567' })).toBeNull()
    expect(matchRecentDocument([], { declaredCost: 1501, phone: '0671234567' })).toBeNull()
  })

  it('returns ambiguous instead of picking a newest when several match', () => {
    const docs = [
      doc({ ttn: '20450000000001', dateTime: '11.11.2026 09:00:00' }),
      doc({ ttn: '20450000000002', dateTime: '11.11.2026 10:30:00' }),
      doc({ ttn: '20450000000003', dateTime: '11.11.2026 08:00:00' }),
    ]
    expect(matchRecentDocument(docs, { declaredCost: 1501, phone: '0671234567' })).toEqual({ ambiguous: true })
  })

  it('returns ambiguous (never binds) when two candidates match (A6)', () => {
    // Same customer, two same-amount orders in the window: phone + cost
    // cannot tell the waybills apart, so the matcher must refuse.
    const docs = [
      doc({ ttn: '20450000000001', dateTime: '11.11.2026 09:00:00' }),
      doc({ ttn: '20450000000002', dateTime: '11.11.2026 10:30:00' }),
    ]
    const res = matchRecentDocument(docs, { declaredCost: 1501, phone: '0671234567' })
    expect(res).toEqual({ ambiguous: true })
    // A non-matching third row does not change the ambiguity.
    const res2 = matchRecentDocument(
      [...docs, doc({ ttn: '20450000000003', cost: 999 })],
      { declaredCost: 1501, phone: '0671234567' },
    )
    expect(res2).toEqual({ ambiguous: true })
  })

  it('parses dateTime as a real timestamp, not a string (A6)', () => {
    // Lexicographic order would rank '01.12.2026' before '30.11.2026';
    // parsed timestamps rank it after. The matcher guards ambiguity, so
    // the ordering is verified on the parser itself.
    expect(parseNpDateTime('01.12.2026 09:00:00')).toBeGreaterThan(parseNpDateTime('30.11.2026 09:00:00'))
    expect(parseNpDateTime('11.11.2026 10:30:00')).toBeGreaterThan(parseNpDateTime('11.11.2026 09:00:00'))
    expect(parseNpDateTime('11.11.2026 09:00:00')).toBe(parseNpDateTime('11.11.2026 09:00:00'))
    expect(parseNpDateTime('not a date')).toBe(0)
    expect(parseNpDateTime('')).toBe(0)
  })

  it('month-boundary pair is ambiguous, not mis-picked (A6)', () => {
    const docs = [
      doc({ ttn: '20450000000001', dateTime: '30.11.2026 09:00:00' }),
      doc({ ttn: '20450000000002', dateTime: '01.12.2026 09:00:00' }),
    ]
    expect(matchRecentDocument(docs, { declaredCost: 1501, phone: '0671234567' })).toEqual({ ambiguous: true })
  })

  it('still binds a single match (A6 regression)', () => {
    const docs = [doc({ ttn: '20450000000001', dateTime: '11.11.2026 10:00:00' })]
    const res = matchRecentDocument(docs, { declaredCost: 1501, phone: '0671234567' })
    expect(res).toEqual({ doc: docs[0] })
  })
})
