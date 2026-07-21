'use server'

import { getCatalogProducts, type CatalogParams } from '@/lib/shop/queries'

/**
 * Server action used by the client-side infinite-scroll list to fetch the next
 * page of products. Returns plain serializable data.
 */
export async function loadMoreProducts(params: CatalogParams) {
  const { items, total, page, perPage } = await getCatalogProducts(params)
  return { items, total, page, perPage }
}
