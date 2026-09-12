import { describe, expect, it } from 'vitest'
import { isAllowedPromUrl, sanitizePromUrl } from '@/lib/prom-import/scraper'

describe('sanitizePromUrl', () => {
  it('rebuilds HTTPS Prom.ua storefront URLs without credentials or custom ports', () => {
    expect(sanitizePromUrl('https://prom.ua/c123-shop.html')).toBe('https://prom.ua/c123-shop.html')
    expect(sanitizePromUrl('https://seller.prom.ua/ua/products')).toBe('https://seller.prom.ua/ua/products')
    expect(sanitizePromUrl('https://PROM.UA:443/catalog?page=2')).toBe('https://prom.ua/catalog?page=2')
  })

  it('rejects non-Prom hosts and deceptive suffixes', () => {
    expect(sanitizePromUrl('https://example.com')).toBeNull()
    expect(sanitizePromUrl('https://prom.ua.evil.example/catalog')).toBeNull()
    expect(sanitizePromUrl('https://evilprom.ua/catalog')).toBeNull()
    expect(sanitizePromUrl('https://169.254.169.254/latest/meta-data')).toBeNull()
  })

  it('rejects unsafe protocols, credentials, and ports', () => {
    expect(sanitizePromUrl('http://prom.ua/catalog')).toBeNull()
    expect(sanitizePromUrl('file:///etc/passwd')).toBeNull()
    expect(sanitizePromUrl('https://user:pass@prom.ua/catalog')).toBeNull()
    expect(sanitizePromUrl('https://prom.ua:8080/catalog')).toBeNull()
    expect(sanitizePromUrl('not-a-url')).toBeNull()
  })
})

describe('isAllowedPromUrl', () => {
  it('mirrors sanitizePromUrl', () => {
    expect(isAllowedPromUrl('https://prom.ua/c123-shop.html')).toBe(true)
    expect(isAllowedPromUrl('https://prom.ua.evil.example/catalog')).toBe(false)
  })
})
