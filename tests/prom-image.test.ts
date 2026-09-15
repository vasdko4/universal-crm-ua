import { describe, it, expect } from 'vitest'
import { upgradePromImageUrl, upgradePromImageList, listingPromImageUrl } from '@/lib/shop/prom-image'

describe('upgradePromImageUrl', () => {
  it('upgrades Prom listing thumbs to 1000×1000', () => {
    expect(
      upgradePromImageUrl('https://images.prom.ua/7555823547_w700_h500_aerogril-13l-dlya.jpg'),
    ).toBe('https://images.prom.ua/7555823547_w1000_h1000_aerogril-13l-dlya.jpg')
  })

  it('leaves non-Prom URLs alone and downsizes oversized Prom URLs', () => {
    expect(upgradePromImageUrl('https://blob.vercel-storage.com/x.jpg')).toBe(
      'https://blob.vercel-storage.com/x.jpg',
    )
    expect(upgradePromImageUrl('https://images.prom.ua/1_w2000_h2000_x.jpg')).toBe(
      'https://images.prom.ua/1_w1000_h1000_x.jpg',
    )
  })

  it('maps a gallery list', () => {
    expect(
      upgradePromImageList(['https://images.prom.ua/1_w200_h200_a.jpg', '/local.png']),
    ).toEqual(['https://images.prom.ua/1_w1000_h1000_a.jpg', '/local.png'])
  })
})

describe('listingPromImageUrl', () => {
  it('keeps catalog photos at 700×500', () => {
    expect(listingPromImageUrl('https://images.prom.ua/1_w2000_h2000_x.jpg')).toBe(
      'https://images.prom.ua/1_w700_h500_x.jpg',
    )
  })
})
