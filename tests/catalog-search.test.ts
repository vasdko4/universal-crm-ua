import { describe, expect, it } from 'vitest'
import { searchTokens } from '@/lib/shop/catalog-search'

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
