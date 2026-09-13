import { describe, it, expect } from 'vitest'
import { storefrontMediaUrl } from '@/lib/shop/own-image-url'
import { parseAllowedImageUrl } from '@/lib/api/safe-image-url'

describe('storefrontMediaUrl', () => {
  it('rewrites Prom CDN URLs onto /api/media', () => {
    expect(
      storefrontMediaUrl(
        'https://magazine-test-ten.vercel.app',
        'https://images.prom.ua/7009554340_w700_h500_paverbank.jpg',
      ),
    ).toBe(
      'https://magazine-test-ten.vercel.app/api/media?src=' +
        encodeURIComponent('https://images.prom.ua/7009554340_w2000_h2000_paverbank.jpg'),
    )
  })

  it('leaves local and blob URLs on their own host', () => {
    expect(storefrontMediaUrl('https://shop.ua', '/products/iphone.png')).toBe(
      'https://shop.ua/products/iphone.png',
    )
    expect(
      storefrontMediaUrl('https://shop.ua', 'https://abc.public.blob.vercel-storage.com/x.webp'),
    ).toBe('https://abc.public.blob.vercel-storage.com/x.webp')
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
