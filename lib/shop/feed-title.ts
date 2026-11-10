/**
 * Short title for the Google Merchant feed (<title>).
 *
 * Shopping ads truncate long titles (around 70 chars on most surfaces),
 * so the feed must not carry the full product name — 95 of 164 products
 * were longer than 70 chars and got cut mid-word. The storefront keeps
 * showing the full name; only the feed uses this trimmed title.
 */

/** Target length: what fits in a Shopping ad without truncation. */
export const FEED_TITLE_MAX = 70

/**
 * Trims a product name to at most `max` chars, cutting at the last space
 * so words stay whole. Returns null for a blank name. A name that already
 * fits is returned as-is (whitespace collapsed).
 */
export function trimFeedTitle(name: string | null | undefined, max: number = FEED_TITLE_MAX): string | null {
  const clean = (name ?? '').replace(/\s+/g, ' ').trim()
  if (!clean) return null
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  // A cut with almost no words in it is worse than a hard cut.
  if (lastSpace < 20) return cut
  return cut.slice(0, lastSpace)
}
