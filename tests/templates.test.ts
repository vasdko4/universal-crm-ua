import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TEMPLATES, TEMPLATE_IDS, isTemplateId, getTemplate } from '@/lib/shop/templates'

const NICHE_IDS = [
  'cosmetics', 'fashion', 'electronics', 'autoparts', 'food', 'sneakers',
  'pharmacy', 'sport', 'toys', 'autochem', 'tea', 'books',
  'plumbing', 'home', 'furniture', 'tools', 'pets', 'flowers',
  'jewelry', 'gifts', 'garden', 'gaming', 'stationery', 'hobby',
  'appliances', 'moto', 'bikes', 'music', 'optics', 'fishing',
]

describe('storefront templates', () => {
  it('has at least 7 templates including 3 premium', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(7)
    expect(TEMPLATES.filter((t) => t.premium).length).toBeGreaterThanOrEqual(3)
  })

  it('has unique ids', () => {
    expect(new Set(TEMPLATE_IDS).size).toBe(TEMPLATE_IDS.length)
  })

  it('every template defines a layout and swatches', () => {
    for (const t of TEMPLATES) {
      expect(['standard', 'marketplace', 'boutique', 'minimal']).toContain(t.layout)
      expect(t.swatches.bg).toBeTruthy()
      expect(t.swatches.primary).toBeTruthy()
      expect(t.name).toBeTruthy()
    }
  })

  it('validates template ids', () => {
    expect(isTemplateId('classic')).toBe(true)
    expect(isTemplateId('marketplace')).toBe(true)
    expect(isTemplateId('nope')).toBe(false)
  })

  it('getTemplate falls back to classic', () => {
    expect(getTemplate('boutique').id).toBe('boutique')
    expect(getTemplate('unknown').id).toBe('classic')
  })

  it('has all 30 niche themes with uk/ru names, descriptions and oklch swatches', () => {
    const oklch = /^oklch\([\d.]+ [\d.]+ [\d.]+\)$/
    for (const id of NICHE_IDS) {
      expect(isTemplateId(id)).toBe(true)
      const tpl = getTemplate(id)
      expect(tpl.niche).toBe(true)
      expect(tpl.name).toBeTruthy()
      expect(tpl.nameRu).toBeTruthy()
      expect(tpl.description).toBeTruthy()
      expect(tpl.descriptionRu).toBeTruthy()
      for (const key of ['bg', 'card', 'primary', 'accent'] as const) {
        expect(tpl.swatches[key]).toMatch(oklch)
      }
    }
  })

  it('every niche theme has a matching [data-template] CSS block', () => {
    const css = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8')
    for (const id of NICHE_IDS) {
      expect(css).toContain(`[data-template='${id}']`)
    }
  })
})
