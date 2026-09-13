import { describe, it, expect } from 'vitest'
import { parseAllowedImageUrl, buildAllowedImageUrl, allowedImageOrigin } from '@/lib/api/safe-image-url'

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

  it('rejects encoded slashes, at-signs and overlong paths', () => {
    expect(buildAllowedImageUrl('https://images.prom.ua/foo%5cbar.jpg')).toBeNull()
    expect(buildAllowedImageUrl('https://images.prom.ua/foo%40bar.jpg')).toBeNull()
    expect(buildAllowedImageUrl('https://images.prom.ua/' + 'a'.repeat(1100))).toBeNull()
  })
})

describe('allowedImageOrigin', () => {
  it('returns a literal origin for known Prom hosts', () => {
    expect(allowedImageOrigin('images.prom.ua')).toBe('https://images.prom.ua')
    expect(allowedImageOrigin('cdn.prom.st')).toBe('https://cdn.prom.st')
  })
})

describe('parseAllowedImageUrl extra hosts', () => {
  it('allows Prom.st and Vercel Blob', () => {
    expect(parseAllowedImageUrl('https://cdn.prom.st/a.jpg')?.hostname).toBe('cdn.prom.st')
    expect(parseAllowedImageUrl('https://foo.public.blob.vercel-storage.com/a.webp')?.hostname).toBe(
      'foo.public.blob.vercel-storage.com',
    )
  })
})
