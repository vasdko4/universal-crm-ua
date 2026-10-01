import { describe, expect, it } from 'vitest'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { productSearchCondition, searchRelevanceOrder } from '@/lib/shop/queries'

/**
 * Full-text product search (Block C) — query building on mocks, no live DB.
 * Fragments are rendered to SQL text with PgDialect.sqlToQuery().
 */
const dialect = new PgDialect()

function render(fragment: SQL | undefined): { text: string; params: unknown[] } | null {
  if (!fragment) return null
  const built = dialect.sqlToQuery(fragment)
  return { text: built.sql, params: built.params as unknown[] }
}

describe('productSearchCondition', () => {
  it('returns undefined for an empty query', () => {
    expect(productSearchCondition('')).toBeUndefined()
    expect(productSearchCondition('   ')).toBeUndefined()
  })

  it('uses the legacy ILIKE path for short queries (<3 chars)', () => {
    const rendered = render(productSearchCondition('24'))
    expect(rendered).not.toBeNull()
    const { text } = rendered!
    expect(text).toContain('ilike')
    expect(text).not.toContain('websearch_to_tsquery')
    expect(text).not.toContain('ts_rank')
    expect(text).not.toContain('similarity')
  })

  it('uses full-text search for queries of 3+ characters', () => {
    const rendered = render(productSearchCondition('ролики'))
    expect(rendered).not.toBeNull()
    const { text, params } = rendered!
    expect(text).toContain('websearch_to_tsquery')
    expect(text).toContain("'simple'")
    expect(text).toContain('search_vector')
    // Whole query goes through as a bound parameter, not string interpolation.
    expect(params).toContain('ролики')
    expect(text).not.toContain('ролики')
  })

  it('adds a pg_trgm similarity fallback for typos (threshold 0.3, both names)', () => {
    const rendered = render(productSearchCondition('роліки'))
    expect(rendered).not.toBeNull()
    const { text } = rendered!
    expect(text).toContain('similarity')
    expect(text).toContain('> 0.3')
    expect(text).toContain('name_uk')
    expect(text).toContain('name_ru')
  })

  it('passes a multi-word query to websearch_to_tsquery as one parameter', () => {
    const rendered = render(productSearchCondition('ролики 29-33'))
    expect(rendered).not.toBeNull()
    expect(rendered!.params).toContain('ролики 29-33')
  })

  it('keeps ILIKE matching for barcode and Prom characteristics', () => {
    const rendered = render(productSearchCondition('ролики'))
    expect(rendered).not.toBeNull()
    const { text } = rendered!
    expect(text).toContain('barcode')
    expect(text).toContain('product_characteristics')
  })

  it('does not interpolate user input into the SQL text', () => {
    const evil = `x' OR '1'='1`
    const rendered = render(productSearchCondition(evil))
    expect(rendered).not.toBeNull()
    const { text, params } = rendered!
    expect(text).not.toContain(evil)
    expect(params).toContain(evil)
  })
})

describe('searchRelevanceOrder', () => {
  it('ranks full-text queries with ts_rank() DESC', () => {
    const rendered = render(searchRelevanceOrder('ролики'))
    expect(rendered).not.toBeNull()
    const { text, params } = rendered!
    expect(text).toContain('ts_rank')
    expect(text).toContain('websearch_to_tsquery')
    expect(text).toMatch(/desc$/i)
    expect(params).toContain('ролики')
  })

  it('keeps the legacy CASE ordering for short queries', () => {
    const rendered = render(searchRelevanceOrder('24'))
    expect(rendered).not.toBeNull()
    const { text } = rendered!
    expect(text).toContain('CASE')
    expect(text).toMatch(/asc$/i)
    expect(text).not.toContain('ts_rank')
  })

  it('falls back to the legacy ordering for an empty query', () => {
    const rendered = render(searchRelevanceOrder(''))
    expect(rendered).not.toBeNull()
    expect(rendered!.text).toContain('CASE')
  })
})
