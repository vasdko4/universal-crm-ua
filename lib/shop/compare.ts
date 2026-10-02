/**
 * Product comparison tray: pure, testable helpers around a localStorage-backed
 * list of product ids. Compare state is guest-only and never touches the DB.
 *
 * `readCompareIds` / `writeCompareIds` are SSR-safe (no-op when `window` is
 * unavailable); `add/remove/toggle/isInCompare` are pure functions over the id
 * array so the React provider and the unit tests share the same logic.
 */

export const COMPARE_STORAGE_KEY = 'shop:compare'
/** Maximum number of products that can be compared side by side. */
export const COMPARE_MAX_ITEMS = 4

export type ToggleResult = {
  ids: number[]
  /** True when the product ended up in the tray. */
  added: boolean
  /** True when the toggle tried to add but the tray was already full. */
  limitReached: boolean
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** De-duplicates and drops non-positive / non-integer ids, preserving order. */
export function cleanCompareIds(ids: unknown): number[] {
  if (!Array.isArray(ids)) return []
  const out: number[] = []
  const seen = new Set<number>()
  for (const raw of ids) {
    const n = Number(raw)
    if (!Number.isInteger(n) || n <= 0 || seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  return out
}

/** Reads the tray from localStorage. Returns [] on the server or on bad data. */
export function readCompareIds(): number[] {
  const storage = getStorage()
  if (!storage) return []
  try {
    const raw = storage.getItem(COMPARE_STORAGE_KEY)
    if (!raw) return []
    return cleanCompareIds(JSON.parse(raw)).slice(0, COMPARE_MAX_ITEMS)
  } catch {
    return []
  }
}

/** Persists the tray to localStorage. No-op on the server. */
export function writeCompareIds(ids: number[]): void {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(cleanCompareIds(ids).slice(0, COMPARE_MAX_ITEMS)))
  } catch {
    // Storage full or unavailable (private mode) — the in-memory tray keeps
    // working for this session.
  }
}

export function isInCompare(ids: number[], productId: number): boolean {
  return ids.includes(productId)
}

/**
 * Adds a product id, enforcing the tray limit. The returned array is new;
 * when the limit is hit the tray is returned unchanged with `limitReached`.
 */
export function addToCompare(ids: number[], productId: number): ToggleResult {
  if (!Number.isInteger(productId) || productId <= 0) return { ids, added: false, limitReached: false }
  if (ids.includes(productId)) return { ids, added: true, limitReached: false }
  if (ids.length >= COMPARE_MAX_ITEMS) return { ids, added: false, limitReached: true }
  return { ids: [...ids, productId], added: true, limitReached: false }
}

export function removeFromCompare(ids: number[], productId: number): number[] {
  if (!ids.includes(productId)) return ids
  return ids.filter((id) => id !== productId)
}

export function toggleCompare(ids: number[], productId: number): ToggleResult {
  if (ids.includes(productId)) return { ids: removeFromCompare(ids, productId), added: false, limitReached: false }
  return addToCompare(ids, productId)
}

// ---------------------------------------------------------------------------
// Spec-row helpers for the comparison table.
// ---------------------------------------------------------------------------

export type CompareSpecValue = string | null

export type CompareSpecRow = {
  /** Spec name, e.g. "Діагональ". */
  name: string
  /** One value per compared product, in column order; null when missing. */
  values: CompareSpecValue[]
}

/** Normalizes a spec value so "128 ГБ" and "128 гб " compare as equal. */
export function normalizeSpecValue(value: CompareSpecValue): string {
  return (value ?? '').trim().toLocaleLowerCase()
}

/**
 * Marks the rows whose values differ across the compared products. A row
 * differs when at least two normalized values are not equal (missing values
 * count as empty, so a spec present on only one product also differs).
 */
export function diffRowFlags(rows: CompareSpecRow[]): boolean[] {
  return rows.map((row) => new Set(row.values.map(normalizeSpecValue)).size > 1)
}

export type SpecSource = {
  characteristics: { name: string; value: string }[]
  options: { name: string; values: string[] }[]
}

/**
 * Builds the comparison table rows for a list of products: the union of all
 * characteristic names (in first-appearance order) followed by one row per
 * option axis ("Розмір: S, M, L"). Duplicate names within one product are
 * merged into a single comma-joined value.
 */
export function buildSpecRows(products: SpecSource[]): CompareSpecRow[] {
  // Merge names case-insensitively ("Діагональ" vs "діагональ") while keeping
  // the first-seen spelling for display; diffRowFlags already compares values
  // case-insensitively.
  const normName = (s: string) => s.trim().toLocaleLowerCase()
  const names: string[] = []
  const seen = new Set<string>()
  for (const p of products) {
    for (const c of p.characteristics) {
      const name = c.name.trim()
      if (!name) continue
      const key = normName(name)
      if (seen.has(key)) continue
      seen.add(key)
      names.push(name)
    }
  }
  const rows: CompareSpecRow[] = names.map((name) => ({
    name,
    values: products.map((p) => {
      const key = normName(name)
      const matches = p.characteristics
        .filter((c) => normName(c.name) === key)
        .map((c) => c.value.trim())
        .filter(Boolean)
      return matches.length > 0 ? matches.join(', ') : null
    }),
  }))
  // Option axes (e.g. size/color) as rows, in first-appearance order.
  const optionNames: string[] = []
  const optionSeen = new Set<string>()
  for (const p of products) {
    for (const o of p.options) {
      const name = o.name.trim()
      if (!name || optionSeen.has(name)) continue
      optionSeen.add(name)
      optionNames.push(name)
    }
  }
  for (const name of optionNames) {
    rows.push({
      name,
      values: products.map((p) => {
        const opt = p.options.find((o) => o.name.trim() === name)
        const vals = (opt?.values ?? []).map((v) => v.trim()).filter(Boolean)
        return vals.length > 0 ? vals.join(', ') : null
      }),
    })
  }
  return rows
}
