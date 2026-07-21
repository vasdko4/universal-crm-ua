import 'server-only'
import { revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/shop/queries'

/**
 * Bust the storefront read caches (catalog lists, popular/discount rails,
 * product pages, category tree). Call this from admin mutations after changing
 * products/categories so shoppers see updates immediately instead of waiting
 * for the time-based refresh. Safe to call often — it only marks tags stale.
 */
export function revalidateStorefront(productId?: number) {
  revalidateTag(CACHE_TAGS.catalog, 'max')
  revalidateTag(CACHE_TAGS.categories, 'max')
  if (productId != null) revalidateTag(CACHE_TAGS.product(productId), 'max')
}
