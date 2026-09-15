import { describe, it, expect } from 'vitest'
import { storefrontMediaUrl, rewritePromHtmlImages, promMediaPath } from '@/lib/shop/own-image-url'
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
        encodeURIComponent('https://images.prom.ua/7009554340_w1000_h1000_paverbank.jpg'),
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

describe('promMediaPath', () => {
  it('keeps Prom CDN on Prom at listing size for Next/Image', () => {
    expect(promMediaPath('https://images.prom.ua/1_w2000_h2000_x.jpg')).toBe(
      'https://images.prom.ua/1_w700_h500_x.jpg',
    )
  })

  it('leaves local paths and already-proxied URLs', () => {
    expect(promMediaPath('/products/a.jpg')).toBe('/products/a.jpg')
    expect(promMediaPath('/api/media?src=https%3A%2F%2Fimages.prom.ua%2F1.jpg')).toBe(
      '/api/media?src=https%3A%2F%2Fimages.prom.ua%2F1.jpg',
    )
  })
})

describe('rewritePromHtmlImages', () => {
  it('resizes Prom img src and leaves other hosts', () => {
    const html =
      '<p>x</p><img src="https://images.prom.ua/7366176545_w700_h500_x.jpg" alt="">' +
      '<img src="https://cdn.example.com/a.jpg">'
    const out = rewritePromHtmlImages(html, 'https://shop.ua')
    expect(out).toContain('https://images.prom.ua/7366176545_w1000_h1000_x.jpg')
    expect(out).not.toContain('/api/media')
    expect(out).toContain('https://cdn.example.com/a.jpg')
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
