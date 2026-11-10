import { describe, it, expect } from 'vitest'
import { extractProductSlug } from '@/lib/shop/product-path'

describe('extractProductSlug', () => {
  it('extracts the slug from a product path', () => {
    expect(extractProductSlug('/product/iphone-15')).toBe('iphone-15')
    expect(extractProductSlug('/product/zariadnyi-prystrii-12v-10a')).toBe('zariadnyi-prystrii-12v-10a')
  })

  it('handles the ru locale prefix', () => {
    expect(extractProductSlug('/ru/product/iphone-15')).toBe('iphone-15')
  })

  it('handles a trailing slash, query string and hash', () => {
    expect(extractProductSlug('/product/iphone-15/')).toBe('iphone-15')
    expect(extractProductSlug('/product/iphone-15?ref=google')).toBe('iphone-15')
    expect(extractProductSlug('/product/iphone-15#reviews')).toBe('iphone-15')
  })

  it('returns null for non-product pages', () => {
    expect(extractProductSlug('/')).toBeNull()
    expect(extractProductSlug('/account')).toBeNull()
    expect(extractProductSlug('/category/phones')).toBeNull()
    expect(extractProductSlug('/product')).toBeNull()
    expect(extractProductSlug('/product/')).toBeNull()
    expect(extractProductSlug('/ru/product/')).toBeNull()
    expect(extractProductSlug('')).toBeNull()
    expect(extractProductSlug(null)).toBeNull()
    expect(extractProductSlug(undefined)).toBeNull()
  })
})
