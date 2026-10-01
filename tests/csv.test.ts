import { describe, it, expect } from 'vitest'
import { csvCell } from '@/lib/csv'

describe('csvCell', () => {
  it('quotes plain values and doubles inner quotes', () => {
    expect(csvCell('hello')).toBe('"hello"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell(123)).toBe('"123"')
    expect(csvCell(null)).toBe('""')
    expect(csvCell(undefined)).toBe('""')
  })

  it('neutralizes formula injection (REGRESSION)', () => {
    // A product name like "=HYPERLINK(...)" must not become an Excel formula.
    expect(csvCell('=1+1')).toBe(`"'=1+1"`)
    expect(csvCell('+cmd')).toBe(`"'+cmd"`)
    expect(csvCell('-2+3')).toBe(`"'-2+3"`)
    expect(csvCell('@evil')).toBe(`"'@evil"`)
    expect(csvCell('\t=1')).toBe(`"'\t=1"`)
  })

  it('leaves safe values untouched', () => {
    expect(csvCell('Товар 123')).toBe('"Товар 123"')
    expect(csvCell('10% знижки')).toBe('"10% знижки"')
  })
})
