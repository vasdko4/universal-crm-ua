import 'server-only'
import { getStoreSettingsInternal } from '@/lib/store-settings'

/** Default: keep catalog/product reads almost fresh. */
export const STOREFRONT_TTL_FRESH = 60
/** Weak-VPS saver: 1 hour. Admin product/category saves still bust via tags. */
export const STOREFRONT_TTL_SAVER = 3600

/**
 * Catalog/product `unstable_cache` TTL. Pages stay `force-dynamic` (locale
 * cookie + CSP nonce), so this is the lever that actually cuts Postgres load.
 */
export async function getStorefrontQueryTtl(): Promise<number> {
  const s = await getStoreSettingsInternal().catch(() => null)
  return s?.storefrontCacheEnabled ? STOREFRONT_TTL_SAVER : STOREFRONT_TTL_FRESH
}
