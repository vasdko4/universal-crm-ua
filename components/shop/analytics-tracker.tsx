'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { sendAnalyticsEvent } from '@/lib/shop/track'
import { trackViewItem, trackPageType, type EcommPageType } from '@/components/shop/google-ads'
import { captureUtmFromLocation } from '@/lib/shop/utm'

// Best-effort mapping from a storefront path to the dynamic-remarketing page
// type Google Ads expects. Product pages fire their own more specific event
// (view_item, in ProductViewTracker below) so they're excluded here.
function pageTypeFor(pathname: string): EcommPageType | null {
  if (pathname === '/' || /^\/(ru)\/?$/.test(pathname)) return 'home'
  if (/^\/(ru\/)?category(\/|$)/.test(pathname)) return 'category'
  if (/^\/(ru\/)?catalog(\/|$)/.test(pathname)) return 'category'
  if (/^\/(ru\/)?cart(\/|$)/.test(pathname)) return 'cart'
  if (/^\/(ru\/)?product(\/|$)/.test(pathname)) return null
  return null
}

// Tracks a pageview on every storefront route change. Mounted once in the
// shop layout so all public pages are covered automatically. Also captures
// ?utm_* attribution params (lib/shop/utm.ts) and fires the Google Ads
// dynamic-remarketing pageview for page types with no dedicated e-commerce
// event (home/category/cart) — see components/shop/google-ads.tsx.
export function AnalyticsTracker({ gaId }: { gaId?: string } = {}) {
  const pathname = usePathname()
  const lastTracked = useRef<string | null>(null)

  useEffect(() => {
    if (!pathname || lastTracked.current === pathname) return
    lastTracked.current = pathname
    sendAnalyticsEvent({ type: 'pageview', path: pathname })
    captureUtmFromLocation()
    const pageType = pageTypeFor(pathname)
    if (pageType) trackPageType(gaId, pageType)
  }, [pathname, gaId])

  return null
}

// Tracks a product detail view. Mount on the product page with the product id.
// Optional gaId/name/price/sku/currency also fire the GA4 view_item event
// alongside our own internal analytics_events row.
export function ProductViewTracker({
  productId,
  gaId,
  name,
  price,
  sku,
  currency,
}: {
  productId: number
  gaId?: string
  name?: string
  price?: number
  sku?: string | null
  currency?: string
}) {
  const tracked = useRef(false)

  useEffect(() => {
    if (tracked.current) return
    tracked.current = true
    sendAnalyticsEvent({ type: 'product_view', productId, path: `/product/${productId}` })
    if (gaId && name != null && price != null) {
      trackViewItem(gaId, { id: productId, name, price, quantity: 1, sku }, currency)
    }
  }, [productId, gaId, name, price, sku, currency])

  return null
}
