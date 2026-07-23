'use client'

import Script from 'next/script'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { CONSENT_COOKIE, readConsentCookie } from '@/lib/shop/consent'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

const isValidAdsId = (id: string) => /^AW-\w+$/.test(id)
const isValidGaId = (id: string) => /^G-\w+$/.test(id)

type CartItem = { id: number; name: string; price: number; quantity: number; sku?: string | null }

// Dynamic remarketing "page type" Google Ads expects in the `ecomm_pagetype`
// parameter — lets Shopping/Display remarketing show the exact products a
// visitor viewed/added to cart instead of generic catalog ads.
export type EcommPageType = 'home' | 'category' | 'product' | 'cart' | 'purchase' | 'searchresults' | 'other'

// Loads the gtag.js snippet once and configures Google Ads conversion
// tracking and/or GA4 (Google Analytics), whichever are enabled in
// Настройки → Google Ads. One script covers both — gtag.js supports
// multiple `config` calls after a single load, so enabling both never
// double-loads the library. Rendered once in the shop layout.
//
// Also wires up Google Consent Mode v2: ad/analytics storage default to
// "denied" until the visitor accepts the cookie banner (components/shop/
// cookie-consent-banner.tsx), or immediately to "granted" if they already
// accepted on a previous visit (cookie read synchronously before the first
// gtag call, so no consent-state flash). This keeps EU traffic measurable
// without violating GDPR — see CookieConsentBanner for the actual prompt.
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
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
  wait_for_update: 500,
});
if (document.cookie.split('; ').some(function(c){ return c.indexOf('${CONSENT_COOKIE}=granted') === 0; })) {
  gtag('consent', 'update', {
    ad_storage: 'granted',
    ad_user_data: 'granted',
    ad_personalization: 'granted',
    analytics_storage: 'granted',
  });
}
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

// Dynamic remarketing parameters, sent as extra fields alongside the normal
// GA4/Ads event params. Google's classic dynamic remarketing tag reads these
// off the same dataLayer pushes gtag() makes, so no separate tag/script is
// needed — see https://support.google.com/google-ads/answer/6053288.
function ecommParams(pagetype: EcommPageType, prodIds?: (string | number)[], totalValue?: number) {
  return {
    ecomm_pagetype: pagetype,
    ...(prodIds && prodIds.length ? { ecomm_prodid: prodIds.map(String) } : {}),
    ...(totalValue != null ? { ecomm_totalvalue: totalValue } : {}),
  }
}

// Fires a dynamic-remarketing pageview for pages with no dedicated e-commerce
// event of their own (home, category listing, search results). Call once per
// navigation; safe no-op without a configured GA/Ads id.
export function trackPageType(
  gaId: string | undefined,
  pagetype: EcommPageType,
  prodIds?: (string | number)[],
) {
  if (!gaId || !isValidGaId(gaId)) return
  fireGtagEvent('page_view', ecommParams(pagetype, prodIds))
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
    ...ecommParams('product', [item.sku || item.id]),
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
    ...ecommParams('cart', [item.sku || item.id]),
  })
}

// GA4 recommended e-commerce event: fired once when the checkout page is
// first opened with a non-empty cart/buy-now item. Fills the gap between
// "added to cart" and "purchased" so funnel drop-off at checkout is visible
// in GA4/Ads reporting (previously there was no signal here at all).
export function trackBeginCheckout(
  gaId: string | undefined,
  items: CartItem[],
  currency = 'UAH',
) {
  if (!gaId || !isValidGaId(gaId) || items.length === 0) return
  const value = items.reduce((s, i) => s + i.price * i.quantity, 0)
  fireGtagEvent('begin_checkout', {
    currency,
    value,
    items: items.map((it) => ({
      item_id: it.sku || String(it.id),
      item_name: it.name,
      price: it.price,
      quantity: it.quantity,
    })),
    ...ecommParams('cart', items.map((i) => i.sku || i.id), value),
  })
}

// Normalizes email/phone the way Google Ads Enhanced Conversions requires
// before hashing: lowercase + trim for email, digits-only E.164-ish for
// phone. gtag.js hashes (SHA-256) these client-side itself — we must send
// normalized plaintext, never pre-hash.
// https://support.google.com/google-ads/answer/9888656
function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}
function normalizePhone(phone: string) {
  const digits = phone.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) return digits
  // Ukrainian numbers are stored locally as 0XXXXXXXXX — E.164 needs +380.
  if (digits.startsWith('0')) return `+38${digits}`
  return `+${digits}`
}

// Fires the Google Ads purchase conversion and, if configured, the GA4
// `purchase` event on the order confirmation page. Deduplicated per order
// via sessionStorage so refreshes/back-navigation never double-count.
//
// When `enhancedConversions` is on and we have the customer's email/phone,
// sends them via `gtag('set', 'user_data', ...)` right before the conversion
// fires — Google matches this (hashed, first-party) against signed-in Google
// accounts to recover conversions lost to cookie/ITP restrictions and to
// improve Smart Bidding, at no cost and no UI change for the customer.
export function GoogleAdsPurchase({
  conversionId,
  conversionLabel,
  gaId,
  orderNumber,
  value,
  currency = 'UAH',
  items,
  enhancedConversions = false,
  customerEmail,
  customerPhone,
}: {
  conversionId?: string
  conversionLabel?: string
  gaId?: string
  orderNumber: string
  value: number
  currency?: string
  items?: CartItem[]
  enhancedConversions?: boolean
  customerEmail?: string | null
  customerPhone?: string | null
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
      if (adsReady && enhancedConversions && (customerEmail || customerPhone)) {
        window.gtag('set', 'user_data', {
          ...(customerEmail ? { email: normalizeEmail(customerEmail) } : {}),
          ...(customerPhone ? { phone_number: normalizePhone(customerPhone) } : {}),
        })
      }
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
          ...ecommParams(
            'purchase',
            (items ?? []).map((it) => it.sku || it.id),
            value,
          ),
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
  }, [
    conversionId,
    conversionLabel,
    gaId,
    orderNumber,
    value,
    currency,
    items,
    enhancedConversions,
    customerEmail,
    customerPhone,
  ])

  return null
}
