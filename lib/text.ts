/** Linear string helpers — no backtracking regex (Sonar S8786). */

export function stripTrailingChars(s: string, chars: string): string {
  let end = s.length
  while (end > 0 && chars.includes(s[end - 1]!)) end -= 1
  return s.slice(0, end)
}

export function stripLeadingChars(s: string, chars: string): string {
  let start = 0
  while (start < s.length && chars.includes(s[start]!)) start += 1
  return s.slice(start)
}

export function stripEdgeDashes(s: string): string {
  return stripTrailingChars(stripLeadingChars(s, '-'), '-')
}

export function stripTrailingSlashes(s: string): string {
  return stripTrailingChars(s, '/')
}

/** Cyrillic → Latin transliteration table shared by slugify(). */
const TRANSLIT_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', ґ: 'g', д: 'd', е: 'e', є: 'ie', ё: 'e',
  ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh',
  ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ы: 'y', э: 'e', ю: 'iu', я: 'ia',
  ь: '', ъ: '',
}

/** URL slug with Cyrillic transliteration. Falls back when nothing remains. */
export function slugify(text: string, fallback = 'item'): string {
  return (
    stripEdgeDashes(
      text
        .toLowerCase()
        .split('')
        .map((ch) => TRANSLIT_MAP[ch] ?? ch)
        .join('')
        .replace(/[^a-z0-9]+/g, '-'),
    ).slice(0, 100) || fallback
  )
}

export function looksLikeEmail(value: string): boolean {
  const at = value.indexOf('@')
  if (at < 1 || at !== value.lastIndexOf('@')) return false
  const domain = value.slice(at + 1)
  const dot = domain.lastIndexOf('.')
  if (dot < 1 || dot >= domain.length - 1) return false
  for (const ch of value) {
    if (ch === ' ' || ch === '\n' || ch === '\t') return false
  }
  return true
}

export function trimQueryJunk(url: string): string {
  return stripTrailingChars(url, '?&')
}

export function stripTags(html: string): string {
  let out = ''
  let inTag = false
  for (const ch of html) {
    if (ch === '<') inTag = true
    else if (ch === '>') inTag = false
    else if (!inTag) out += ch
  }
  return out
}

/** Drop `<script>` / `<style>` blocks (tags + body) without a backtracking regex. */
export function stripScriptAndStyle(html: string): string {
  let out = ''
  let i = 0
  const lower = html.toLowerCase()
  while (i < html.length) {
    const openScript = lower.indexOf('<script', i)
    const openStyle = lower.indexOf('<style', i)
    let open = -1
    let closeNeedle = ''
    if (openScript >= 0 && (openStyle < 0 || openScript < openStyle)) {
      open = openScript
      closeNeedle = '</script>'
    } else if (openStyle >= 0) {
      open = openStyle
      closeNeedle = '</style>'
    }
    if (open < 0) {
      out += html.slice(i)
      break
    }
    out += html.slice(i, open)
    const close = lower.indexOf(closeNeedle, open)
    i = close < 0 ? html.length : close + closeNeedle.length
  }
  return out
}
