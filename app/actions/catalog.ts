'use server'

import { getCatalogProducts, toListingCard, type CatalogParams } from '@/lib/shop/queries'

/**
 * Server action used by the client-side "show more" list to fetch the next
 * page of products. Returns plain serializable data, slimmed to the fields a
 * listing card renders (see toListingCard) so paging stays cheap.
 */
export async function loadMoreProducts(params: CatalogParams) {
  const { items, total, page, perPage } = await getCatalogProducts(params)
  return { items: items.map(toListingCard), total, page, perPage }
}
