import { describe, it, expect } from 'vitest'
import { parseAllowedImageUrl } from '@/lib/api/safe-image-url'

describe('parseAllowedImageUrl', () => {
  it('rebuilds an allowlisted https URL without userinfo', () => {
    const u = parseAllowedImageUrl('https://images.prom.ua/foo/bar.jpg?w=100')
    expect(u?.toString()).toBe('https://images.prom.ua/foo/bar.jpg?w=100')
  })

  it('rejects unknown hosts and http', () => {
    expect(parseAllowedImageUrl('https://evil.example/x')).toBeNull()
    expect(parseAllowedImageUrl('http://images.prom.ua/x')).toBeNull()
    expect(parseAllowedImageUrl('https://169.254.169.254/latest')).toBeNull()
    expect(parseAllowedImageUrl('not-a-url')).toBeNull()
  })

  it('rejects credentials and non-443 ports', () => {
    expect(parseAllowedImageUrl('https://user:pass@images.prom.ua/x')).toBeNull()
    expect(parseAllowedImageUrl('https://images.prom.ua:8080/x')).toBeNull()
  })
})
