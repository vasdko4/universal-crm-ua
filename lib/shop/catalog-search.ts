import { sanitizeSearch } from '@/lib/api/helpers'

/**
 * Split a shopper query into AND-tokens.
 * One-character fragments are dropped when a longer token exists, so
 * "ролики 29" still matches, while a lone "24" remains searchable.
 */
export function searchTokens(raw: string): string[] {
  const cleaned = sanitizeSearch(raw).trim()
  if (!cleaned) return []
  const parts = cleaned.split(/\s+/).filter(Boolean)
  const long = parts.filter((t) => t.length >= 2)
  const chosen = long.length > 0 ? long : parts
  return chosen.slice(0, 5)
}
