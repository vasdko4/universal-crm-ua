import { describe, it, expect } from 'vitest'
import { TEMPLATES, TEMPLATE_IDS, isTemplateId, getTemplate } from '@/lib/shop/templates'

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
})
