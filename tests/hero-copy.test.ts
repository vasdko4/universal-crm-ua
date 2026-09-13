import { describe, it, expect } from 'vitest'
import { defaultHeroSlides } from '@/lib/shop/home-hero-slides'

describe('hero copy', () => {
  it('uses the correct Ukrainian COD spelling', () => {
    const slides = defaultHeroSlides('uk', 'До каталогу')
    const pay = slides.find((s) => s.tone === 'pay')
    expect(pay?.text).toContain('Накладений платіж')
    expect(pay?.text).not.toContain('Наложений')
  })
})
