import { describe, it, expect } from 'vitest'
import { normalizeOrigin } from '@/lib/seo'

describe('normalizeOrigin', () => {
  it('keeps an explicit http origin the admin typed', () => {
    expect(normalizeOrigin('http://mystore.com/')).toBe('http://mystore.com')
  })

  it('defaults a bare hostname to https', () => {
    expect(normalizeOrigin('mystore.com')).toBe('https://mystore.com')
  })

  it('keeps https', () => {
    expect(normalizeOrigin('https://mystore.com/shop')).toBe('https://mystore.com')
  })
})
