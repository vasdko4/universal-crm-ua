/**
 * Decode the HTML entities that show up in Prom.ua titles / product names
 * (`&#x27;`, `&#39;`, `&amp;`, …) without pulling in a full entity library.
 * Safe to run on already-plain text: strings without `&` are returned as-is.
 */
export function decodeHtmlEntities(s: string): string {
  if (!s.includes('&')) return s
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => fromCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => fromCode(parseInt(dec, 10)))
    .replace(/&amp;/gi, '&')
}

function fromCode(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return ''
  try {
    return String.fromCodePoint(code)
  } catch {
    return ''
  }
}
