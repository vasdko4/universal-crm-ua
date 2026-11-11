/**
 * Advisory-lock identity for Prom-import category creation.
 *
 * Distinct from the prom-sync namespace (20261111): different jobs must
 * never block each other. The lock key is (parentId, name) — the sibling
 * slot a category would be created in — so two workers racing the same
 * path serialize, while different branches never wait on each other.
 */
export const PROM_IMPORT_CATEGORY_LOCK_NS = 20261112

/** Lock key for one sibling slot: the parent id plus the category name. */
export function categoryLockKey(parentId: number | null, nameUk: string): string {
  return `cat:${parentId ?? 'root'}:${nameUk}`
}
