'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { sendAnalyticsEvent } from '@/lib/shop/track'
import { trackViewItem } from '@/components/shop/google-ads'

// Tracks a pageview on every storefront route change. Mounted once in the
// shop layout so all public pages are covered automatically.
export function AnalyticsTracker() {
  const pathname = usePathname()
  const lastTracked = useRef<string | null>(null)

  useEffect(() => {
    if (!pathname || lastTracked.current === pathname) return
    lastTracked.current = pathname
    sendAnalyticsEvent({ type: 'pageview', path: pathname })
  }, [pathname])

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
