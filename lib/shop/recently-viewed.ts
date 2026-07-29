// Plain localStorage-backed "recently viewed products" list. Client-only,
// per-browser (no account sync needed — unlike favorites, this is a soft
// merchandising nudge, not user data worth persisting server-side).
const STORAGE_KEY = 'techno-recently-viewed-v1'
const MAX_ITEMS = 12

function readIds(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0)
  } catch {
    return []
  }
}

// Records a product view: moves the id to the front, dedupes, caps the list.
// Call this once per product-page mount (client component).
export function recordProductView(productId: number): void {
  if (!Number.isInteger(productId) || productId <= 0) return
  try {
    const ids = readIds().filter((id) => id !== productId)
    ids.unshift(productId)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, MAX_ITEMS)))
  } catch {
    // ignore (private mode / storage disabled)
  }
}

// Returns recently viewed ids, most-recent-first, excluding the product
// currently being displayed (no point recommending the page you're on).
export function getRecentlyViewedIds(excludeId?: number): number[] {
  const ids = readIds()
  return excludeId ? ids.filter((id) => id !== excludeId) : ids
}
