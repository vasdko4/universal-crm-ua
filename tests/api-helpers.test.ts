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
