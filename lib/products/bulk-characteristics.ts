/**
 * Bulk brand + characteristics editing: normalization and upsert planning.
 * Pure functions (no DB) so they are unit-testable; the server action in
 * app/actions/products.ts applies the plan inside a transaction.
 */

/** Canonical characteristic name used for the "brand" input. */
export const BRAND_CHAR_NAME = 'Бренд'

/** Max name/value pairs per bulk operation (keeps the drawer and query sane). */
export const MAX_BULK_CHARS = 10

const MAX_NAME_LEN = 255

export type CharInput = { name: string; value: string }
export type ExistingChar = { id: number; name: string; value: string; sortOrder: number | null }

/**
 * Normalize raw drawer input into a clean upsert list.
 * - brand (if non-empty) becomes `{ name: 'Бренд', value }` and wins over a
 *   manually added characteristic with the same name (case-insensitive);
 * - empty names/values are dropped (never erase data by accident);
 * - duplicates are collapsed case-insensitively, first wins;
 * - capped at MAX_BULK_CHARS.
 */
export function normalizeBulkCharacteristics(brand: string, chars: CharInput[]): CharInput[] {
  const out: CharInput[] = []
  const seen = new Set<string>()
  const push = (name: string, value: string) => {
    const n = name.trim().slice(0, MAX_NAME_LEN)
    const v = value.trim()
    if (!n || !v) return
    const key = n.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push({ name: n, value: v })
  }
  push(BRAND_CHAR_NAME, brand)
  for (const c of chars ?? []) {
    if (out.length >= MAX_BULK_CHARS) break
    push(c.name ?? '', c.value ?? '')
  }
  return out
}

/**
 * Plan per-product upserts: match updates against existing characteristics
 * case-insensitively by name. Existing rows keep their original name casing;
 * only changed values are updated. New names are appended after the current
 * max sortOrder.
 */
export function planCharacteristicUpserts(
  existing: ExistingChar[],
  updates: CharInput[],
): { toUpdate: { id: number; value: string }[]; toInsert: CharInput[] } {
  const byName = new Map<string, ExistingChar>()
  for (const row of existing) {
    const key = row.name.trim().toLowerCase()
    if (key && !byName.has(key)) byName.set(key, row)
  }
  const toUpdate: { id: number; value: string }[] = []
  const toInsert: CharInput[] = []
  for (const u of updates) {
    const row = byName.get(u.name.trim().toLowerCase())
    if (!row) {
      toInsert.push(u)
    } else if (row.value !== u.value) {
      toUpdate.push({ id: row.id, value: u.value })
    }
  }
  return { toUpdate, toInsert }
}
