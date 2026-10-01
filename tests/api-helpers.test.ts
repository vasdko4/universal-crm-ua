import { describe, it, expect } from 'vitest'
import { parsePositiveInt, parseListParams, readJson, normDays, normLimit, escapeLikeWildcards, ilikeEscaped, normPageParams } from '@/lib/api/helpers'
import { products } from '@/lib/db/schema'

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

  it('rejects a body over the byte cap', async () => {
    const req = new Request('https://x.test/api/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"x":"' + 'a'.repeat(80_000) + '"}',
    })
    expect(await readJson(req, 64 * 1024)).toBeNull()
  })

  it('rejects an oversized Content-Length without reading the body', async () => {
    const req = new Request('https://x.test/api/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': '999999' },
      body: '{"ok":true}',
    })
    expect(await readJson(req, 64 * 1024)).toBeNull()
  })
})

describe('normDays', () => {
  it('clamps to 1..730 and floors', () => {
    expect(normDays(30)).toBe(30)
    expect(normDays(0)).toBe(1)
    expect(normDays(-5)).toBe(1)
    expect(normDays(10000)).toBe(730)
    expect(normDays(7.9)).toBe(7)
    expect(normDays(NaN)).toBe(30)
    expect(normDays('30' as unknown as number)).toBe(30)
  })
})

describe('normLimit', () => {
  it('clamps to 1..100 (REGRESSION: LIMIT -1 = unlimited in Postgres)', () => {
    expect(normLimit(8)).toBe(8)
    expect(normLimit(-1)).toBe(1)
    expect(normLimit(0)).toBe(1)
    expect(normLimit(1000)).toBe(100)
    expect(normLimit(NaN, 20)).toBe(20)
  })
})

describe('escapeLikeWildcards', () => {
  it('escapes %, _ and backslash so they stay literal (REGRESSION: "%" matched everything)', () => {
    expect(escapeLikeWildcards('%')).toBe('\\%')
    expect(escapeLikeWildcards('100% cotton_under')).toBe('100\\% cotton\\_under')
    expect(escapeLikeWildcards('a\\b')).toBe('a\\\\b')
    expect(escapeLikeWildcards('plain')).toBe('plain')
  })
})

describe('ilikeEscaped', () => {
  it('emits an explicit ESCAPE clause so escaped wildcards work', () => {
    const frag = ilikeEscaped(products.nameRu, '%100\\%%')
    const built = frag.getSQL() as unknown as { queryChunks: Array<{ value?: string[] } | string> }
    const text = built.queryChunks
      .map((c) => (typeof c === 'string' ? c : (c.value ?? []).join('')))
      .join('')
    expect(text).toContain('ILIKE')
    expect(text).toContain("ESCAPE '\\'")
  })
})

describe('normPageParams', () => {
  it('clamps page >= 1 and pageSize to 1..100 (REGRESSION: page=-3, pageSize=1e9)', () => {
    expect(normPageParams(1, 10)).toEqual({ page: 1, pageSize: 10 })
    expect(normPageParams(-3, 10)).toEqual({ page: 1, pageSize: 10 })
    expect(normPageParams(2, 1e9)).toEqual({ page: 2, pageSize: 100 })
    expect(normPageParams(0, 0)).toEqual({ page: 1, pageSize: 1 })
    expect(normPageParams(NaN, NaN)).toEqual({ page: 1, pageSize: 10 })
    expect(normPageParams('2' as unknown as number, 8, 8)).toEqual({ page: 1, pageSize: 8 })
  })
})
