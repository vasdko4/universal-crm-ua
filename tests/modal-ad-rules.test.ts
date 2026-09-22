import { describe, expect, it } from 'vitest'
import {
  GLOBAL_COOLDOWN_MS,
  classifyStorefrontPath,
  emptyCapState,
  markDismissed,
  markShown,
  pickEligibleAd,
  type ModalAdCap,
} from '@/lib/shop/modal-ad-rules'

const sale: ModalAdCap = {
  id: 1,
  targetPages: ['all'],
  frequency: 'session',
  frequencyDays: 7,
}
const extra: ModalAdCap = {
  id: 2,
  targetPages: ['catalog'],
  frequency: 'every',
  frequencyDays: 1,
}

describe('classifyStorefrontPath', () => {
  it('keeps shopping pages and silences checkout / account', () => {
    expect(classifyStorefrontPath('/')).toBe('home')
    expect(classifyStorefrontPath('/ru')).toBe('home')
    expect(classifyStorefrontPath('/catalog')).toBe('catalog')
    expect(classifyStorefrontPath('/ru/product/slug')).toBe('product')
    expect(classifyStorefrontPath('/cart')).toBe('cart')
    expect(classifyStorefrontPath('/checkout')).toBe('quiet')
    expect(classifyStorefrontPath('/ru/checkout/pay/ABC')).toBe('quiet')
    expect(classifyStorefrontPath('/account/orders')).toBe('quiet')
    expect(classifyStorefrontPath('/order/1')).toBe('quiet')
  })
})

describe('pickEligibleAd', () => {
  const now = 1_700_000_000_000

  it('shows the first matching campaign on a shopping page', () => {
    expect(pickEligibleAd([sale, extra], 'home', emptyCapState(), now)?.id).toBe(1)
  })

  it('never shows on checkout or account', () => {
    expect(pickEligibleAd([sale], 'quiet', emptyCapState(), now)).toBeNull()
  })

  it('does not rotate a second campaign in the same session', () => {
    const afterFirst = markShown(emptyCapState(), 1, now)
    expect(pickEligibleAd([sale, extra], 'catalog', afterFirst, now + 5_000)).toBeNull()
  })

  it('holds a global 24h cooldown across campaigns', () => {
    const afterFirst = markShown(emptyCapState(), 1, now)
    afterFirst.anyThisSession = false
    afterFirst.sessionShown = {}
    expect(pickEligibleAd([extra], 'catalog', afterFirst, now + GLOBAL_COOLDOWN_MS - 1)).toBeNull()
    expect(pickEligibleAd([extra], 'catalog', afterFirst, now + GLOBAL_COOLDOWN_MS)?.id).toBe(2)
  })

  it('hides a dismissed campaign for two weeks without blocking a later other one after cooldown', () => {
    let state = markShown(emptyCapState(), 1, now)
    state = markDismissed(state, 1, now)
    state.anyThisSession = false
    state.sessionShown = {}
    const later = now + GLOBAL_COOLDOWN_MS
    expect(pickEligibleAd([sale, extra], 'catalog', state, later)?.id).toBe(2)
    expect(pickEligibleAd([sale], 'home', state, later)).toBeNull()
  })

  it('respects per-campaign days frequency after the global cooldown', () => {
    const daysAd: ModalAdCap = { id: 3, targetPages: ['all'], frequency: 'days', frequencyDays: 7 }
    let state = markShown(emptyCapState(), 3, now)
    state.anyThisSession = false
    state.sessionShown = {}
    expect(pickEligibleAd([daysAd], 'home', state, now + GLOBAL_COOLDOWN_MS)).toBeNull()
    expect(pickEligibleAd([daysAd], 'home', state, now + 7 * 24 * 60 * 60 * 1000)?.id).toBe(3)
  })
})
