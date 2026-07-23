// Marketing attribution: whenever a visitor lands with ?utm_* params, store
// them in a first-party cookie so the order created later in the same
// session (or within COOKIE_MAX_AGE_DAYS) can be tagged with the campaign
// that actually drove it — independent of GA4/Google Ads, which under-report
// due to ad blockers, Safari ITP, or a visitor declining the cookie banner.
//
// Last-touch: each new set of utm params overwrites the previous ones, since
// the most recent ad click is what convinced the customer to check out.
export const UTM_COOKIE = 'utm_attribution'
const COOKIE_MAX_AGE_DAYS = 30

export type UtmParams = {
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmTerm?: string
  utmContent?: string
}

const PARAM_MAP: Record<keyof UtmParams, string> = {
  utmSource: 'utm_source',
  utmMedium: 'utm_medium',
  utmCampaign: 'utm_campaign',
  utmTerm: 'utm_term',
  utmContent: 'utm_content',
}

// Reads utm_* from the current URL. Called on every route change; only
// writes the cookie when at least one param is present so a later
// (no-utm) internal navigation never clears a real click's attribution.
export function captureUtmFromLocation() {
  if (typeof window === 'undefined') return
  const sp = new URLSearchParams(window.location.search)
  const found: UtmParams = {}
  let any = false
  for (const [key, param] of Object.entries(PARAM_MAP) as [keyof UtmParams, string][]) {
    const value = sp.get(param)
    if (value) {
      found[key] = value.slice(0, 150)
      any = true
    }
  }
  if (!any) return
  try {
    const maxAge = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60
    document.cookie = `${UTM_COOKIE}=${encodeURIComponent(JSON.stringify(found))}; path=/; max-age=${maxAge}; samesite=lax`
  } catch {
    // ignore (cookies disabled)
  }
}
