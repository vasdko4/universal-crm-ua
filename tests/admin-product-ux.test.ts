import { describe, it, expect } from 'vitest'

import { parsePriceInput, parseStockInput } from '@/components/products/inline-edit-cell'
import { reorderItems } from '@/components/products/image-uploader'

describe('parsePriceInput', () => {
  it('parses a plain number', () => {
    expect(parsePriceInput('1299')).toBe(1299)
  })

  it('accepts a comma as the decimal separator', () => {
    expect(parsePriceInput('1 299,50')).toBe(1299.5)
  })

  it('strips spaces', () => {
    expect(parsePriceInput(' 2 500 ')).toBe(2500)
  })

  it('returns NaN for garbage', () => {
    expect(parsePriceInput('abc')).toBeNaN()
  })
})

describe('parseStockInput', () => {
  it('parses an integer quantity', () => {
    expect(parseStockInput('15')).toBe(15)
  })

  it('truncates decimals', () => {
    expect(parseStockInput('7.9')).toBe(7)
  })

  it('returns NaN for garbage', () => {
    expect(parseStockInput('—')).toBeNaN()
  })
})

describe('reorderItems', () => {
  it('moves an item forward', () => {
    expect(reorderItems(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('moves an item backward', () => {
    expect(reorderItems(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
  })

  it('returns the same array for no-op moves', () => {
    const items = ['a', 'b']
    expect(reorderItems(items, 1, 1)).toBe(items)
  })

  it('returns the same array for out-of-range indexes', () => {
    const items = ['a', 'b']
    expect(reorderItems(items, -1, 1)).toBe(items)
    expect(reorderItems(items, 0, 5)).toBe(items)
  })
})
