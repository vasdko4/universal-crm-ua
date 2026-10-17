'use client'

import Script from 'next/script'
import { useCallback, useEffect, useRef } from 'react'

declare global {
  interface Window {
    gapi?: {
      load: (module: string, cb: () => void) => void
      surveyoptin?: { render: (opts: Record<string, unknown>) => void }
    }
    gcrRenderOptIn?: () => void
  }
}

// Google Merchant Center account id for PowerFox. The Customer Reviews
// program is enabled in MC (17.10.2026), and the opt-in module on the order
// confirmation page is the mandatory step — without it Google reports
// "couldn't collect data from your website" and no seller ratings are
// collected for Shopping ads.
const GCR_MERCHANT_ID = 5871800327

// Realistic delivery estimate: Nova Poshta transit is 1–3 business days
// plus order handling, so +5 calendar days is a safe promise.
const ESTIMATED_DELIVERY_DAYS = 5

function estimatedDeliveryDate(from: Date): string {
  const d = new Date(from.getTime())
  d.setDate(d.getDate() + ESTIMATED_DELIVERY_DAYS)
  return d.toISOString().slice(0, 10) // YYYY-MM-DD, as Google expects
}

// Renders the Google Customer Reviews opt-in on the order confirmation
// screen. Google shows its own overlay dialog offering the buyer a review
// survey — this component renders nothing visible itself. Skipped silently
// when the order has no customer email (Google requires it to send the
// survey), e.g. phone-only checkouts.
export function GoogleReviewsOptIn({
  orderId,
  email,
}: {
  orderId: string
  email?: string | null
}) {
  const rendered = useRef(false)

  const trimmedEmail = email?.trim()

  const renderOptIn = useCallback(() => {
    if (rendered.current) return
    const surveyoptin = window.gapi?.surveyoptin
    if (!surveyoptin || !trimmedEmail) return
    rendered.current = true
    surveyoptin.render({
      merchant_id: GCR_MERCHANT_ID,
      order_id: orderId,
      email: trimmedEmail,
      delivery_country: 'UA',
      estimated_delivery_date: estimatedDeliveryDate(new Date()),
    })
  }, [orderId, trimmedEmail])

  useEffect(() => {
    // platform.js calls this global via the ?onload= query parameter.
    window.gcrRenderOptIn = renderOptIn
    return () => {
      delete window.gcrRenderOptIn
    }
  }, [renderOptIn])

  if (!trimmedEmail) return null

  return (
    <Script
      src="https://apis.google.com/js/platform.js?onload=gcrRenderOptIn"
      strategy="afterInteractive"
      onLoad={renderOptIn}
    />
  )
}
