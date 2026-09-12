import { describe, expect, it } from 'vitest'
import { isAllowedPromUrl } from '@/lib/prom-import/scraper'

describe('isAllowedPromUrl', () => {
  it('accepts HTTPS Prom.ua storefront URLs', () => {
    expect(isAllowedPromUrl('https://prom.ua/c123-shop.html')).toBe(true)
    expect(isAllowedPromUrl('https://seller.prom.ua/ua/products')).toBe(true)
    expect(isAllowedPromUrl('https://PROM.UA:443/catalog')).toBe(true)
  })

  it('rejects non-Prom hosts and deceptive suffixes', () => {
    expect(isAllowedPromUrl('https://example.com')).toBe(false)
    expect(isAllowedPromUrl('https://prom.ua.evil.example/catalog')).toBe(false)
    expect(isAllowedPromUrl('https://evilprom.ua/catalog')).toBe(false)
    expect(isAllowedPromUrl('https://169.254.169.254/latest/meta-data')).toBe(false)
  })

  it('rejects unsafe protocols, credentials, and ports', () => {
    expect(isAllowedPromUrl('http://prom.ua/catalog')).toBe(false)
    expect(isAllowedPromUrl('file:///etc/passwd')).toBe(false)
    expect(isAllowedPromUrl('https://user:pass@prom.ua/catalog')).toBe(false)
    expect(isAllowedPromUrl('https://prom.ua:8080/catalog')).toBe(false)
    expect(isAllowedPromUrl('not-a-url')).toBe(false)
  })
})
