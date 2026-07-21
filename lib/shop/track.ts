'use client'

// Lightweight client-side analytics sender. Fire-and-forget: failures are
// silently ignored so tracking never breaks the storefront UX.

const SESSION_KEY = 'techno-analytics-session'

export function getAnalyticsSessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return 'anonymous'
  }
}

// External referrer for traffic-source reports; internal navigation is
// ignored so each visit's source is counted only once.
function getExternalReferrer(): string | undefined {
  try {
    if (!document.referrer) return undefined
    const ref = new URL(document.referrer)
    if (ref.origin === window.location.origin) return undefined
    return document.referrer.slice(0, 300)
  } catch {
    return undefined
  }
}

export function sendAnalyticsEvent(event: {
  type: 'pageview' | 'product_view' | 'add_to_cart'
  path?: string
  productId?: number
}) {
  try {
    const payload = JSON.stringify({
      ...event,
      sessionId: getAnalyticsSessionId(),
      referrer: event.type === 'pageview' ? getExternalReferrer() : undefined,
    })
    // sendBeacon survives page navigations; fetch keepalive is the fallback.
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' })
      navigator.sendBeacon('/api/track', blob)
    } else {
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {})
    }
  } catch {
    // ignore
  }
}
