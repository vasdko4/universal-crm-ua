import { describe, it, expect } from 'vitest'
import {
  MODAL_AD_THEMES,
  MODAL_AD_THEME_DEFAULT,
  normalizeModalAdTheme,
} from '@/lib/shop/modal-ad-themes'

describe('modal ad themes', () => {
  it('exposes six themes with classic as default', () => {
    expect(MODAL_AD_THEMES).toHaveLength(6)
    expect(MODAL_AD_THEMES).toContain('classic')
    expect(MODAL_AD_THEME_DEFAULT).toBe('classic')
  })

  it('normalizes known theme keys', () => {
    for (const key of MODAL_AD_THEMES) {
      expect(normalizeModalAdTheme(key)).toBe(key)
    }
  })

  it('falls back to classic for unknown or missing values', () => {
    expect(normalizeModalAdTheme('nope')).toBe('classic')
    expect(normalizeModalAdTheme(null)).toBe('classic')
    expect(normalizeModalAdTheme(undefined)).toBe('classic')
    expect(normalizeModalAdTheme(42)).toBe('classic')
  })
})
