import { describe, it, expect } from 'vitest'
import { upgradePromImageUrl, upgradePromImageList } from '@/lib/shop/prom-image'

describe('upgradePromImageUrl', () => {
  it('upgrades Prom listing thumbs to 2000×2000', () => {
    expect(
      upgradePromImageUrl('https://images.prom.ua/7555823547_w700_h500_aerogril-13l-dlya.jpg'),
    ).toBe('https://images.prom.ua/7555823547_w2000_h2000_aerogril-13l-dlya.jpg')
  })

  it('leaves non-Prom URLs and already-large Prom URLs alone', () => {
    expect(upgradePromImageUrl('https://blob.vercel-storage.com/x.jpg')).toBe(
      'https://blob.vercel-storage.com/x.jpg',
    )
    expect(upgradePromImageUrl('https://images.prom.ua/1_w2000_h2000_x.jpg')).toBe(
      'https://images.prom.ua/1_w2000_h2000_x.jpg',
    )
  })

  it('maps a gallery list', () => {
    expect(
      upgradePromImageList(['https://images.prom.ua/1_w200_h200_a.jpg', '/local.png']),
    ).toEqual(['https://images.prom.ua/1_w2000_h2000_a.jpg', '/local.png'])
  })
})
