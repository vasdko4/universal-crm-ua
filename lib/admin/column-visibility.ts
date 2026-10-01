/**
 * Column-visibility helpers for admin tables.
 *
 * The stored value is the list of *visible* column ids. Resolution is pure:
 * unknown ids are dropped and an empty/invalid stored list falls back to
 * showing everything (so a stale key can never hide the whole table).
 */

/**
 * Resolve the effective visible column list.
 * @param stored visible column ids read from storage, or null when unset
 * @param allColumns every known column id, in display order
 */
export function resolveVisibleColumns(
  stored: string[] | null,
  allColumns: string[],
): string[] {
  if (!Array.isArray(stored)) return [...allColumns]
  const known = new Set(allColumns)
  const visible = stored.filter((c) => known.has(c))
  return visible.length > 0 ? visible : [...allColumns]
}

/** Toggle a column id inside a visible list, preserving display order. */
export function toggleColumn(
  visible: string[],
  allColumns: string[],
  id: string,
): string[] {
  const next = visible.includes(id)
    ? visible.filter((c) => c !== id)
    : [...visible, id]
  const order = new Map(allColumns.map((c, i) => [c, i]))
  return next.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
}
