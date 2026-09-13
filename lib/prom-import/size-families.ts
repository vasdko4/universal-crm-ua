/**
 * Prom.ua often lists each size range as its own product
 * ("Ролики 29-33" / "Ролики 34-37") instead of one page with a selector.
 * These helpers pull a size suffix off the title so the importer can merge
 * those listings into one product with a size axis.
 */

const RANGE = /(\d{2})\s*[-–—]\s*(\d{2})/
const LETTER = /\b(XXXL|XXL|XL|XS|S|M|L)\b/i
const SIZE_WORD = /(?:розмір|размер|size|р\.?)\s*/i

export function extractSizeFromName(name: string): { base: string; size: string } | null {
  const trimmed = name.trim().replace(/\s+/g, ' ')
  if (!trimmed) return null

  const rangeAtEnd = trimmed.match(new RegExp(`(?:[\\s(]+(?:${SIZE_WORD.source})?)(${RANGE.source})\\s*\\)?\\s*$`, 'i'))
  if (rangeAtEnd) {
    const size = `${rangeAtEnd[2]}-${rangeAtEnd[3]}`
    const base = trimmed.slice(0, rangeAtEnd.index).trim().replace(/[(\-–,]+$/, '').trim()
    if (base.length >= 3) return { base, size }
  }

  const letterAtEnd = trimmed.match(new RegExp(`(?:[\\s(]+(?:${SIZE_WORD.source})?)(${LETTER.source})\\s*\\)?\\s*$`, 'i'))
  if (letterAtEnd) {
    const size = letterAtEnd[1].toUpperCase().replace('Х', 'X')
    const base = trimmed.slice(0, letterAtEnd.index).trim().replace(/[(\-–,]+$/, '').trim()
    if (base.length >= 3) return { base, size }
  }

  const numbered = trimmed.match(new RegExp(`(?:[\\s(]+${SIZE_WORD.source})(\\d{2})\\s*\\)?\\s*$`, 'i'))
  if (numbered) {
    const size = numbered[1]
    const base = trimmed.slice(0, numbered.index).trim().replace(/[(\-–,]+$/, '').trim()
    if (base.length >= 3) return { base, size }
  }

  return null
}

export function extractSizeFromUrlText(urlText: string): { base: string; size: string } | null {
  const raw = urlText.trim().replace(/\.html$/i, '')
  const range = raw.match(/-(\d{2})-(\d{2})$/)
  if (range) {
    return { base: raw.slice(0, range.index), size: `${range[1]}-${range[2]}` }
  }
  const letter = raw.match(/-(xxxl|xxl|xl|xs|s|m|l)$/i)
  if (letter) {
    return { base: raw.slice(0, letter.index), size: letter[1].toUpperCase() }
  }
  return null
}

export function familyKeyFromParts(base: string): string {
  return base
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-zа-яёіїєґ0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
}

export const SIZE_OPTION_NAME_UK = 'Розмір'
export const SIZE_OPTION_NAME_RU = 'Размер'

export type SizeFamilyState = {
  productId: number
  promId: number
  size: string
  inStock: boolean
  merged: boolean
}
