/**
 * Hygiene for prom.ua imports.
 *
 * Prom.ua listings are frequently written in Russian or mixed language, and
 * sellers sometimes contradict themselves (title says 30000 mAh, the body
 * says 20000). The Ukrainian storefront must not inherit either problem.
 *
 * - `cleanUkrainianDescription()` silently fixes unambiguous standalone
 *   Russian words in the Ukrainian description HTML.
 * - `findCapacityMismatch()` flags a title-vs-body mAh contradiction for a
 *   human to review (specs are never auto-changed).
 */

/**
 * Whole-word RU -> UK replacements. Only words that are unambiguous in
 * Ukrainian commercial copy: each of these was observed verbatim in real
 * imported listings and fixed by hand before this module existed.
 *
 * Matching is whole-word only (Unicode letter boundaries), so substrings
 * inside other words ("миксер", "навесні", "зможете") are never touched.
 * Cyrillic cannot appear in HTML tags/attributes (ASCII), so running the
 * regex over the raw HTML string is safe.
 */
const RU_UK_WORDS: Array<[ru: string, uk: string]> = [
  ['или', 'або'],
  ['и', 'і'],
  ['уже', 'вже'],
  ['цвет', 'колір'],
  ['задний', 'задній'],
  ['задняя', 'задня'],
  ['заднее', 'заднє'],
  ['задние', 'задні'],
]

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

export function cleanUkrainianDescription(html: string): { html: string; fixedWords: string[] } {
  const fixed = new Set<string>()
  let out = html
  for (const [ru, uk] of RU_UK_WORDS) {
    // Whole-word, Unicode-aware; the lookarounds keep HTML tags intact
    // because tags never contain Cyrillic letters.
    const re = new RegExp(`(?<![\\p{L}\\p{N}_])${ru}(?![\\p{L}\\p{N}_])`, 'giu')
    out = out.replace(re, (match) => {
      fixed.add(match.toLowerCase())
      return match.charAt(0) === match.charAt(0).toUpperCase() &&
        match.charAt(0) !== match.charAt(0).toLowerCase()
        ? capitalize(uk)
        : uk
    })
  }
  return { html: out, fixedWords: [...fixed] }
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, ' ')
}

const MAH_RE = /(\d[\d\s]*)\s*mAh(?![\p{L}\p{N}_])/giu
const MAH_UK_RE =
  /(\d[\d\s]*)\s*мА\s*\.?\s*ч(?![\p{L}\p{N}_])|(\d[\d\s]*)\s*мА\s*[·.]\s*год(?![\p{L}\p{N}_])/giu

function normalizeMah(raw: string): string {
  return raw.replace(/\s+/g, '')
}

export type CapacityMismatch = {
  /** Normalized number from the product title, e.g. "30000". */
  titleMah: string
  /** Normalized numbers found in the description body, e.g. ["20000"]. */
  bodyMah: string[]
}

/**
 * Returns a mismatch when the title names a capacity (mAh) that never
 * appears in the description body. Returns null when there is nothing to
 * compare (no numbers on either side) or everything agrees.
 */
export function findCapacityMismatch(
  nameUk: string | null | undefined,
  descriptionHtml: string | null | undefined,
): CapacityMismatch | null {
  if (!nameUk || !descriptionHtml) return null
  // MAH_RE / MAH_UK_RE are module-level globals; reset lastIndex before
  // each use so repeated calls behave identically.
  MAH_RE.lastIndex = 0
  const titleMatch = MAH_RE.exec(nameUk)
  if (!titleMatch) return null
  const titleMah = normalizeMah(titleMatch[1])

  const text = stripTags(descriptionHtml)
  const bodyMah = new Set<string>()
  let m: RegExpExecArray | null
  MAH_UK_RE.lastIndex = 0
  while ((m = MAH_UK_RE.exec(text)) !== null) {
    const raw = m[1] ?? m[2]
    if (raw) bodyMah.add(normalizeMah(raw))
  }
  // Also accept the Latin "mAh" spelling inside a Ukrainian description.
  MAH_RE.lastIndex = 0
  while ((m = MAH_RE.exec(text)) !== null) {
    bodyMah.add(normalizeMah(m[1]))
  }
  if (bodyMah.size === 0) return null
  if (bodyMah.has(titleMah)) return null
  return { titleMah, bodyMah: [...bodyMah] }
}
