import { describe, it, expect } from 'vitest'
import { localizedPath, stripLocalePrefix } from '@/lib/i18n/config'

describe('localizedPath', () => {
  it('leaves uk (default locale) paths unprefixed', () => {
    expect(localizedPath('/', 'uk')).toBe('/')
    expect(localizedPath('/product/5', 'uk')).toBe('/product/5')
    expect(localizedPath('/catalog?popular=1', 'uk')).toBe('/catalog?popular=1')
  })

  it('prefixes ru paths with /ru', () => {
    expect(localizedPath('/', 'ru')).toBe('/ru')
    expect(localizedPath('/product/5', 'ru')).toBe('/ru/product/5')
    expect(localizedPath('/catalog?popular=1', 'ru')).toBe('/ru/catalog?popular=1')
  })
})

describe('stripLocalePrefix', () => {
  it('strips a leading /ru segment', () => {
    expect(stripLocalePrefix('/ru')).toBe('/')
    expect(stripLocalePrefix('/ru/product/5')).toBe('/product/5')
  })

  it('leaves unprefixed paths untouched', () => {
    expect(stripLocalePrefix('/')).toBe('/')
    expect(stripLocalePrefix('/product/5')).toBe('/product/5')
    // Must not strip paths that merely start with "ru" as a real segment name.
    expect(stripLocalePrefix('/rukavichka')).toBe('/rukavichka')
  })

  it('round-trips with localizedPath for both locales', () => {
    for (const path of ['/', '/catalog', '/product/5', '/category/3?sort=price']) {
      expect(stripLocalePrefix(localizedPath(path, 'uk'))).toBe(path)
      expect(stripLocalePrefix(localizedPath(path, 'ru'))).toBe(path)
    }
  })
})
