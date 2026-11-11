// Pure paging normalization for catalog queries. Server actions accept
// arbitrary params, so NaN/Infinity/fractions and absurd depths must never
// reach the query: a NaN offset breaks it, and a deep offset scans the
// table. Kept import-free so unit tests can load it without the DB layer.

export const MAX_CATALOG_PAGE = 100
export const DEFAULT_PER_PAGE = 12
export const MAX_PER_PAGE = 48

export function normalizeCatalogPaging(
  page?: number,
  perPage?: number,
): { page: number; perPage: number } {
  const safePage = Number.isFinite(page) ? Math.floor(page as number) : 1
  const safePerPage = Number.isFinite(perPage) ? Math.floor(perPage as number) : DEFAULT_PER_PAGE
  return {
    page: Math.min(MAX_CATALOG_PAGE, Math.max(1, safePage)),
    perPage: Math.min(MAX_PER_PAGE, Math.max(1, safePerPage)),
  }
}
