'use client'

import Script from 'next/script'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

const isValidAdsId = (id: string) => /^AW-\w+$/.test(id)
const isValidGaId = (id: string) => /^G-\w+$/.test(id)

type CartItem = { id: number; name: string; price: number; quantity: number; sku?: string | null }

// Loads the gtag.js snippet once and configures Google Ads conversion
// tracking and/or GA4 (Google Analytics), whichever are enabled in
// Настройки → Google Ads. One script covers both — gtag.js supports
// multiple `config` calls after a single load, so enabling both never
// double-loads the library. Rendered once in the shop layout.
export function GoogleTag({ adsId, gaId }: { adsId?: string; gaId?: string }) {
  const validAds = adsId && isValidAdsId(adsId) ? adsId : null
  const validGa = gaId && isValidGaId(gaId) ? gaId : null
  if (!validAds && !validGa) return null

  // gtag.js only needs one id in its script URL to load; each `config` call
  // below is what actually activates that specific product.
  const loaderId = validAds ?? validGa!
  const configCalls = [validAds, validGa]
    .filter((id): id is string => Boolean(id))
    .map((id) => `gtag('config', '${id}');`)
    .join('\n')

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${loaderId}`}
        strategy="afterInteractive"
      />
      <Script id="google-gtag-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
${configCalls}`}
      </Script>
    </>
  )
}

// GA4's own `config` call only reports a page_view for the very first load;
// client-side route changes (this is a SPA) need a manual page_view per
// navigation. Mounted once in the shop layout, alongside GoogleTag.
export function GoogleAnalyticsPageview({ gaId }: { gaId?: string }) {
  const pathname = usePathname()
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (!gaId || !isValidGaId(gaId) || !pathname) return
    if (isFirstRender.current) {
      // Already reported by gtag's own initial `config` call above — skip
      // to avoid double-counting the landing pageview.
      isFirstRender.current = false
      return
    }
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', { page_path: pathname })
    }
  }, [gaId, pathname])

  return null
}

function fireGtagEvent(name: string, params: Record<string, unknown>) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag('event', name, params)
}

// GA4 recommended e-commerce event: fired once per product page view.
export function trackViewItem(gaId: string | undefined, item: CartItem, currency = 'UAH') {
  if (!gaId || !isValidGaId(gaId)) return
  fireGtagEvent('view_item', {
    currency,
    value: item.price,
    items: [
      { item_id: item.sku || String(item.id), item_name: item.name, price: item.price, quantity: 1 },
    ],
  })
}

// GA4 recommended e-commerce event: fired whenever an item is added to cart.
export function trackAddToCart(gaId: string | undefined, item: CartItem, currency = 'UAH') {
  if (!gaId || !isValidGaId(gaId)) return
  fireGtagEvent('add_to_cart', {
    currency,
    value: item.price * item.quantity,
    items: [
      {
        item_id: item.sku || String(item.id),
        item_name: item.name,
        price: item.price,
        quantity: item.quantity,
      },
    ],
  })
}

// Fires the Google Ads purchase conversion and, if configured, the GA4
// `purchase` event on the order confirmation page. Deduplicated per order
// via sessionStorage so refreshes/back-navigation never double-count.
export function GoogleAdsPurchase({
  conversionId,
  conversionLabel,
  gaId,
  orderNumber,
  value,
  currency = 'UAH',
  items,
}: {
  conversionId?: string
  conversionLabel?: string
  gaId?: string
  orderNumber: string
  value: number
  currency?: string
  items?: CartItem[]
}) {
  useEffect(() => {
    const adsReady = conversionId && isValidAdsId(conversionId) && conversionLabel
    const gaReady = gaId && isValidGaId(gaId)
    if (!adsReady && !gaReady) return

    const key = `gads-conv-${orderNumber}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {
      // sessionStorage unavailable (private mode) — fire anyway.
    }

    // gtag may not be ready yet if the layout script is still loading.
    const fire = () => {
      if (typeof window.gtag !== 'function') return false
      if (adsReady) {
        window.gtag('event', 'conversion', {
          send_to: `${conversionId}/${conversionLabel}`,
          value,
          currency,
          transaction_id: orderNumber,
        })
      }
      if (gaReady) {
        window.gtag('event', 'purchase', {
          transaction_id: orderNumber,
          value,
          currency,
          items: (items ?? []).map((it) => ({
            item_id: it.sku || String(it.id),
            item_name: it.name,
            price: it.price,
            quantity: it.quantity,
          })),
        })
      }
      return true
    }
    if (!fire()) {
      const timer = setInterval(() => {
        if (fire()) clearInterval(timer)
      }, 500)
      // Give up after 10s so we never leak the interval.
      const stop = setTimeout(() => clearInterval(timer), 10000)
      return () => {
        clearInterval(timer)
        clearTimeout(stop)
      }
    }
  }, [conversionId, conversionLabel, gaId, orderNumber, value, currency, items])

  return null
}
