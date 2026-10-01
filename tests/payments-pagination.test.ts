import { describe, it, expect } from 'vitest'
import { normalizePaymentPage, totalPages } from '@/lib/payments/pagination'
import { getAdminDictionary } from '@/lib/i18n/admin/dictionaries'

describe('normalizePaymentPage', () => {
  it('defaults to page 1 with 10 per page (same as other admin lists)', () => {
    expect(normalizePaymentPage()).toEqual({ page: 1, pageSize: 10, offset: 0, limit: 10 })
    expect(normalizePaymentPage({})).toEqual({ page: 1, pageSize: 10, offset: 0, limit: 10 })
  })

  it('clamps page below 1 to 1 (negative OFFSET would 500 in Postgres)', () => {
    expect(normalizePaymentPage({ page: -3 }).page).toBe(1)
    expect(normalizePaymentPage({ page: 0 }).page).toBe(1)
    expect(normalizePaymentPage({ page: -3 }).offset).toBe(0)
  })

  it('floors fractional pages and falls back on non-finite input', () => {
    expect(normalizePaymentPage({ page: 2.9 }).page).toBe(2)
    expect(normalizePaymentPage({ page: NaN }).page).toBe(1)
    expect(normalizePaymentPage({ page: Infinity }).page).toBe(1)
    expect(normalizePaymentPage({ page: '3' as unknown as number }).page).toBe(1)
  })

  it('clamps pageSize to 1..100 (huge payloads and zero-limit guarded)', () => {
    expect(normalizePaymentPage({ pageSize: 1e9 }).pageSize).toBe(100)
    expect(normalizePaymentPage({ pageSize: 0 }).pageSize).toBe(1)
    expect(normalizePaymentPage({ pageSize: -5 }).pageSize).toBe(1)
    expect(normalizePaymentPage({ pageSize: 2.9 }).pageSize).toBe(2)
    expect(normalizePaymentPage({ pageSize: NaN }).pageSize).toBe(10)
  })

  it('computes offset and limit for the query', () => {
    expect(normalizePaymentPage({ page: 3, pageSize: 10 })).toEqual({
      page: 3,
      pageSize: 10,
      offset: 20,
      limit: 10,
    })
    expect(normalizePaymentPage({ page: 2, pageSize: 25 })).toEqual({
      page: 2,
      pageSize: 25,
      offset: 25,
      limit: 25,
    })
  })
})

describe('totalPages', () => {
  it('is at least 1 even for an empty list', () => {
    expect(totalPages(0, 10)).toBe(1)
  })

  it('rounds partial pages up', () => {
    expect(totalPages(10, 10)).toBe(1)
    expect(totalPages(11, 10)).toBe(2)
    expect(totalPages(95, 10)).toBe(10)
    expect(totalPages(100, 25)).toBe(4)
  })
})

describe('deleteUser friendly error copy', () => {
  it('has a non-empty deleteFailed message in uk', () => {
    const s = getAdminDictionary('uk').users.deleteFailed
    expect(typeof s).toBe('string')
    expect(s.length).toBeGreaterThan(0)
    // Friendly: no raw SQL/driver jargon leaked to the admin UI
    expect(s).not.toMatch(/error|Error|SQL|code/i)
  })

  it('has a non-empty deleteFailed message in ru', () => {
    const s = getAdminDictionary('ru').users.deleteFailed
    expect(typeof s).toBe('string')
    expect(s.length).toBeGreaterThan(0)
    expect(s).not.toMatch(/error|Error|SQL|code/i)
  })
})
