/**
 * Prom.ua breadcrumbs often use a broader caption than the demo tree
 * ("Техніка та електроніка" vs seeded "Електроніка"). Exact-name matching
 * then creates a second root and imported products never land in the
 * storefront category the merchant already has.
 *
 * Aliases are explicit pairs only — do not fuzzy-match "Аксесуари" to
 * "Аксесуари та прикраси" (jewelry vs phone cases).
 */

function foldCategoryName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

const CATEGORY_NAME_ALIASES: Record<string, readonly string[]> = {
  електроніка: ['техніка та електроніка'],
  'техніка та електроніка': ['електроніка'],
  электроника: ['техника и электроника', 'електроніка'],
  'техника и электроника': ['электроника'],
}

export function categoryNameCandidates(name: string): string[] {
  const folded = foldCategoryName(name)
  if (!folded) return []
  const aliases = CATEGORY_NAME_ALIASES[folded] ?? []
  return [folded, ...aliases.map(foldCategoryName)]
}

export function categoryNamesMatch(a: string, b: string): boolean {
  const left = foldCategoryName(a)
  if (!left) return false
  return categoryNameCandidates(b).includes(left)
}

/** First sibling whose Ukrainian (or Russian) name aliases `nameUk`. */
export function findAliasedCategory<T extends { nameUk: string; nameRu?: string | null }>(
  siblings: T[],
  nameUk: string,
): T | undefined {
  const want = new Set(categoryNameCandidates(nameUk))
  return siblings.find((s) => {
    if (want.has(foldCategoryName(s.nameUk))) return true
    if (s.nameRu && want.has(foldCategoryName(s.nameRu))) return true
    return false
  })
}
