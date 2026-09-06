import { describe, it, expect } from 'vitest'
import { parsePositiveInt, parseListParams, readJson } from '@/lib/api/helpers'

describe('parsePositiveInt', () => {
  it('accepts 1+', () => {
    expect(parsePositiveInt('1')).toBe(1)
    expect(parsePositiveInt('42')).toBe(42)
  })
  it('rejects garbage and non-positive', () => {
    expect(parsePositiveInt('abc')).toBeNull()
    expect(parsePositiveInt('0')).toBeNull()
    expect(parsePositiveInt('-1')).toBeNull()
    expect(parsePositiveInt('1.5')).toBeNull()
    expect(parsePositiveInt('')).toBeNull()
  })
})

describe('parseListParams search', () => {
  it('strips NUL so Postgres does not 500', () => {
    const { search } = parseListParams('https://x.test/api/pages?search=%00hello')
    expect(search).toBe('hello')
    expect(search.includes('\0')).toBe(false)
  })

  it('strips NUL from q= used by /api/orders', () => {
    const { search } = parseListParams('https://x.test/api/orders?q=%00')
    expect(search).toBe('')
    expect(search.includes('\0')).toBe(false)
  })
})

describe('parseListParams pagination', () => {
  it('defaults page and pageSize when omitted', () => {
    const { page, pageSize, error } = parseListParams('https://x.test/api/pages')
    expect(error).toBeNull()
    expect(page).toBe(1)
    expect(pageSize).toBe(10)
  })

  it('rejects fractional pageSize that would 500 in Postgres LIMIT', () => {
    const { error } = parseListParams('https://x.test/api/pages?pageSize=1.5')
    expect(error).toBe('Некорректный pageSize')
  })

  it('rejects pageSize 0, negatives, and values over 100', () => {
    expect(parseListParams('https://x.test/api/pages?pageSize=0').error).toBe('Некорректный pageSize')
    expect(parseListParams('https://x.test/api/pages?pageSize=-5').error).toBe('Некорректный pageSize')
    expect(parseListParams('https://x.test/api/pages?pageSize=9999').error).toBe('Некорректный pageSize')
  })

  it('rejects non-integer and non-positive page', () => {
    expect(parseListParams('https://x.test/api/pages?page=1.5').error).toBe('Некорректный page')
    expect(parseListParams('https://x.test/api/pages?page=0').error).toBe('Некорректный page')
    expect(parseListParams('https://x.test/api/pages?page=-5').error).toBe('Некорректный page')
  })
})

describe('readJson', () => {
  it('returns null for invalid JSON instead of throwing', async () => {
    const req = new Request('https://x.test/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    })
    expect(await readJson(req)).toBeNull()
  })

  it('parses a valid object', async () => {
    const req = new Request('https://x.test/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"items":[1]}',
    })
    expect(await readJson<{ items: number[] }>(req)).toEqual({ items: [1] })
  })
})
