'use server'

import { getProductsByIds, type ShopProduct } from '@/lib/shop/queries'
import { getLocale } from '@/lib/i18n/server'

// Resolves full product data for a "recently viewed" id list kept purely in
// the visitor's own localStorage (no account/DB storage — same guest-only
// approach as the favorites list, just without the logged-in sync). Ids for
// products that are gone, unpublished, or out of the catalog are silently
// dropped; the response preserves the caller's id order (most-recent-first).
export async function getRecentlyViewedProducts(ids: number[]): Promise<ShopProduct[]> {
  const clean = Array.from(
    new Set((ids || []).map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0)),
  ).slice(0, 12)
  if (clean.length === 0) return []
  const locale = await getLocale()
  return getProductsByIds(clean, locale)
}
