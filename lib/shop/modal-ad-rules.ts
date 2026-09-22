import { stripLocalePrefix } from '@/lib/i18n/config'

export type ModalPageType = 'home' | 'catalog' | 'product' | 'cart' | 'quiet'

export type ModalFrequency = 'every' | 'session' | 'days'

export type ModalAdCap = {
  id: number
  targetPages: string[]
  frequency: ModalFrequency
  frequencyDays: number
}

export type ModalCapState = {
  lastAnyAt: number | null
  shownAt: Record<string, number>
  dismissedAt: Record<string, number>
  sessionShown: Record<string, true>
  anyThisSession: boolean
}

/** After any popup, do not show another campaign until this elapses. */
export const GLOBAL_COOLDOWN_MS = 24 * 60 * 60 * 1000
/** Closing without a click hides that campaign for two weeks. */
export const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000

export function emptyCapState(): ModalCapState {
  return {
    lastAnyAt: null,
    shownAt: {},
    dismissedAt: {},
    sessionShown: {},
    anyThisSession: false,
  }
}

export function classifyStorefrontPath(pathname: string): ModalPageType {
  const path = stripLocalePrefix(pathname).replace(/\/+$/, '') || '/'
  if (
    path === '/checkout' ||
    path.startsWith('/checkout/') ||
    path === '/account' ||
    path.startsWith('/account/') ||
    path === '/order' ||
    path.startsWith('/order/') ||
    path === '/sign-in' ||
    path === '/login' ||
    path === '/setup' ||
    path.startsWith('/setup/')
  ) {
    return 'quiet'
  }
  if (path === '/') return 'home'
  if (path === '/catalog' || path.startsWith('/catalog/')) return 'catalog'
  if (path.startsWith('/product/')) return 'product'
  if (path === '/cart') return 'cart'
  return 'quiet'
}

function matchesPage(ad: ModalAdCap, page: ModalPageType): boolean {
  if (page === 'quiet') return false
  const pages = ad.targetPages ?? []
  return pages.includes('all') || pages.includes(page)
}

function daysMs(ad: ModalAdCap): number {
  return Math.max(1, ad.frequencyDays || 7) * 24 * 60 * 60 * 1000
}

/** First eligible campaign, or null when a popup would feel like spam. */
export function pickEligibleAd(
  ads: ModalAdCap[],
  page: ModalPageType,
  state: ModalCapState,
  now: number,
): ModalAdCap | null {
  if (page === 'quiet') return null
  if (state.anyThisSession) return null
  if (state.lastAnyAt != null && now - state.lastAnyAt < GLOBAL_COOLDOWN_MS) return null

  for (const ad of ads) {
    if (!matchesPage(ad, page)) continue
    const id = String(ad.id)
    const dismissed = state.dismissedAt[id]
    if (dismissed != null && now - dismissed < DISMISS_COOLDOWN_MS) continue
    if (state.sessionShown[id]) continue
    const shown = state.shownAt[id]
    if (ad.frequency === 'days' && shown != null && now - shown < daysMs(ad)) continue
    // `every` still respects the global 24h + one-per-session caps above.
    // `session` is the same once those caps exist; per-id session is extra.
    return ad
  }
  return null
}

export function markShown(state: ModalCapState, id: number, now: number): ModalCapState {
  const key = String(id)
  return {
    lastAnyAt: now,
    shownAt: { ...state.shownAt, [key]: now },
    dismissedAt: state.dismissedAt,
    sessionShown: { ...state.sessionShown, [key]: true },
    anyThisSession: true,
  }
}

export function markDismissed(state: ModalCapState, id: number, now: number): ModalCapState {
  return {
    ...state,
    dismissedAt: { ...state.dismissedAt, [String(id)]: now },
  }
}
