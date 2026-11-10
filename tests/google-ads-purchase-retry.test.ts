import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

describe('purchase retry', () => {
  it('marks the order only after gtag has accepted event calls', () => {
    const src = readFileSync('components/shop/google-ads.tsx', 'utf8')
    const effect = src.slice(src.indexOf('export function GoogleAdsPurchase'))
    expect(effect.indexOf("if (typeof window.gtag !== 'function') return false")).toBeLessThan(effect.indexOf("sessionStorage.setItem(key, '1')"))
    expect(effect.indexOf("window.gtag('event', 'purchase'")).toBeLessThan(effect.indexOf("sessionStorage.setItem(key, '1')"))
  })
})
