// Google Consent Mode v2 — shared cookie name + reader used by both the
// server-rendered gtag init script (components/shop/google-ads.tsx) and the
// client-side consent banner (components/shop/cookie-consent-banner.tsx).
//
// Kept intentionally simple (granted | denied, no per-category toggles):
// this store doesn't need cookie-category granularity, and Google's own
// consent model only distinguishes ad vs. analytics storage anyway, both of
// which we grant/deny together here.
export const CONSENT_COOKIE = 'cookie_consent'
const CONSENT_MAX_AGE_DAYS = 180

export type ConsentChoice = 'granted' | 'denied'

export function readConsentCookie(): ConsentChoice | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${CONSENT_COOKIE}=`))
  const value = match?.split('=')[1]
  return value === 'granted' || value === 'denied' ? value : null
}

export function writeConsentCookie(choice: ConsentChoice) {
  if (typeof document === 'undefined') return
  const maxAge = CONSENT_MAX_AGE_DAYS * 24 * 60 * 60
  document.cookie = `${CONSENT_COOKIE}=${choice}; path=/; max-age=${maxAge}; samesite=lax`
}

export function updateGtagConsent(choice: ConsentChoice) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  const state = choice === 'granted' ? 'granted' : 'denied'
  window.gtag('consent', 'update', {
    ad_storage: state,
    ad_user_data: state,
    ad_personalization: state,
    analytics_storage: state,
  })
}
