import { describe, it, expect } from 'vitest'
import {
  categoryNameCandidates,
  categoryNamesMatch,
  findAliasedCategory,
} from '@/lib/shop/category-aliases'

describe('category aliases', () => {
  it('maps Prom electronics breadcrumb onto the demo root', () => {
    expect(categoryNamesMatch('Електроніка', 'Техніка та електроніка')).toBe(true)
    expect(categoryNamesMatch('Техніка та електроніка', 'Електроніка')).toBe(true)
    expect(categoryNameCandidates('Техніка та електроніка')).toContain('електроніка')
  })

  it('does not collapse unrelated accessory trees', () => {
    expect(categoryNamesMatch('Аксесуари', 'Аксесуари та прикраси')).toBe(false)
    expect(categoryNamesMatch('Аудіо', 'Електроніка')).toBe(false)
  })

  it('picks the seeded sibling when Prom uses a longer caption', () => {
    const siblings = [
      { id: 1, nameUk: 'Електроніка', nameRu: 'Электроника' },
      { id: 2, nameUk: 'Аксесуари', nameRu: 'Аксессуары' },
    ]
    expect(findAliasedCategory(siblings, 'Техніка та електроніка')?.id).toBe(1)
    expect(findAliasedCategory(siblings, 'Аксесуари та прикраси')).toBeUndefined()
  })
})
