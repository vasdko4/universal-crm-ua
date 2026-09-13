import { describe, expect, it } from 'vitest'
import {
  facetLabel,
  isFacetKey,
  parseCharFilters,
  searchTokens,
  serializeCharFilters,
} from '@/lib/shop/catalog-search'

describe('searchTokens', () => {
  it('splits a phrase into AND-tokens', () => {
    expect(searchTokens('  ролики  29-33 ')).toEqual(['ролики', '29-33'])
  })

  it('keeps a short numeric query', () => {
    expect(searchTokens('24')).toEqual(['24'])
  })

  it('drops a 1-char fragment next to a real word', () => {
    expect(searchTokens('інвертор в 24')).toEqual(['інвертор', '24'])
  })

  it('returns nothing for empty input', () => {
    expect(searchTokens('   ')).toEqual([])
  })
})

describe('parseCharFilters', () => {
  it('reads name:value groups from the URL', () => {
    expect(parseCharFilters('Розмір:29-33,34-37;Бренд:Bosch')).toEqual([
      { name: 'Розмір', value: '29-33' },
      { name: 'Розмір', value: '34-37' },
      { name: 'Бренд', value: 'Bosch' },
    ])
  })

  it('ignores unknown facet names', () => {
    expect(parseCharFilters('foo:bar;Напруга:24В')).toEqual([{ name: 'Напруга', value: '24В' }])
  })

  it('round-trips through serialize', () => {
    const filters = parseCharFilters('Розмір:29-33;Бренд:Bosch')
    expect(parseCharFilters(serializeCharFilters(filters))).toEqual(filters)
  })
})

describe('facet helpers', () => {
  it('maps Prom keys to a shopper-facing label', () => {
    expect(facetLabel('напряжение', 'uk')).toBe('Напруга')
    expect(facetLabel('розмір', 'ru')).toBe('Размер')
  })

  it('accepts known facet keys only', () => {
    expect(isFacetKey('Бренд')).toBe(true)
    expect(isFacetKey('гарантія')).toBe(false)
  })
})
