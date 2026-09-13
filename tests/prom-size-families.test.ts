import { describe, expect, it } from 'vitest'
import {
  extractSizeFromName,
  extractSizeFromUrlText,
  familyKeyFromParts,
} from '@/lib/prom-import/size-families'

describe('extractSizeFromName', () => {
  it('pulls a numeric range off the end of a listing title', () => {
    expect(extractSizeFromName('Роликові ковзани 29-33')).toEqual({
      base: 'Роликові ковзани',
      size: '29-33',
    })
    expect(extractSizeFromName('Ролики 34–37')).toEqual({
      base: 'Ролики',
      size: '34-37',
    })
  })

  it('pulls a letter size off the end', () => {
    expect(extractSizeFromName('Футболка зелена XL')).toEqual({
      base: 'Футболка зелена',
      size: 'XL',
    })
    expect(extractSizeFromName('Худі (XXL)')).toEqual({
      base: 'Худі',
      size: 'XXL',
    })
  })

  it('returns null when the title has no size suffix', () => {
    expect(extractSizeFromName('Інвертор 24В')).toBeNull()
    expect(extractSizeFromName('')).toBeNull()
  })
})

describe('extractSizeFromUrlText', () => {
  it('reads a range from the Prom urlText slug', () => {
    expect(extractSizeFromUrlText('rolikovye-konki-29-33')).toEqual({
      base: 'rolikovye-konki',
      size: '29-33',
    })
  })
})

describe('familyKeyFromParts', () => {
  it('normalizes sibling titles to the same key', () => {
    const a = extractSizeFromName('Роликові ковзани 29-33')!
    const b = extractSizeFromName('Роликові ковзани 34-37')!
    expect(familyKeyFromParts(a.base)).toBe(familyKeyFromParts(b.base))
  })
})
