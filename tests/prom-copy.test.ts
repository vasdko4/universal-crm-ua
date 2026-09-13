import { describe, it, expect } from 'vitest'
import { honestOldPrice, stripPromMarketplaceCopy } from '@/lib/prom-import/scraper'

describe('honestOldPrice', () => {
  it('drops the doubled Prom.ua strike-through', () => {
    expect(honestOldPrice(2070, 4140)).toBeNull()
    expect(honestOldPrice(28290, 56580)).toBeNull()
  })

  it('keeps a smaller real markdown', () => {
    expect(honestOldPrice(599, 799)).toBe(799)
  })
})

describe('stripPromMarketplaceCopy', () => {
  it('removes Prom.ua marketplace tails from titles', () => {
    expect(stripPromMarketplaceCopy('Павербанк купити на Prom.ua | Україна, Київ')).toBe('Павербанк')
    expect(stripPromMarketplaceCopy('Ролики | Prom.ua')).toBe('Ролики')
  })
})
