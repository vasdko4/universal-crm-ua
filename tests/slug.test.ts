import { describe, it, expect } from 'vitest'
import { slugify } from '@/lib/slug'

describe('slugify', () => {
  it('transliterates Cyrillic', () => {
    expect(slugify('Смартфони')).toBe('smartfony')
    expect(slugify('Навушники та аудіо')).toBe('navushnyky-ta-audio')
  })

  it('handles Latin with spaces and symbols', () => {
    expect(slugify('Hello, World!')).toBe('hello-world')
    expect(slugify('  trim me  ')).toBe('trim-me')
  })

  it('collapses repeated separators', () => {
    expect(slugify('a --- b')).toBe('a-b')
  })

  it('returns empty string for symbols only', () => {
    expect(slugify('!!!')).toBe('')
  })

  it('caps length at 200 characters', () => {
    expect(slugify('a'.repeat(500)).length).toBeLessThanOrEqual(200)
  })
})
