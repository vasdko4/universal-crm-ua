import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ADMIN_THEMES,
  ADMIN_THEME_IDS,
  isAdminThemeId,
  getAdminTheme,
} from '@/lib/admin/admin-themes'

describe('admin panel themes', () => {
  it('has 8 themes with unique ids', () => {
    expect(ADMIN_THEMES.length).toBe(8)
    expect(new Set(ADMIN_THEME_IDS).size).toBe(ADMIN_THEME_IDS.length)
  })

  it('every theme has uk/ru names, descriptions and oklch swatches', () => {
    const oklch = /^oklch\([\d.]+ [\d.]+ [\d.]+\)$/
    for (const t of ADMIN_THEMES) {
      expect(t.name).toBeTruthy()
      expect(t.nameRu).toBeTruthy()
      expect(t.description).toBeTruthy()
      expect(t.descriptionRu).toBeTruthy()
      for (const key of ['primary', 'sidebar', 'surface'] as const) {
        expect(t.swatches[key]).toMatch(oklch)
      }
    }
  })

  it('validates theme ids and falls back to teal', () => {
    expect(isAdminThemeId('midnight')).toBe(true)
    expect(isAdminThemeId('nope')).toBe(false)
    expect(getAdminTheme('violet').id).toBe('violet')
    expect(getAdminTheme('unknown').id).toBe('teal')
  })

  it('every theme has a matching [data-admin-theme] CSS block', () => {
    const css = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8')
    for (const id of ADMIN_THEME_IDS) {
      expect(css).toContain(`[data-admin-theme='${id}']`)
    }
  })
})
