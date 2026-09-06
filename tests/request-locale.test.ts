import { describe, it, expect } from 'vitest'
import { localeFromRequest } from '@/lib/i18n/request-locale'

function req(url: string, headers: Record<string, string> = {}) {
  return { url, headers: new Headers(headers) }
}

describe('localeFromRequest', () => {
  it('prefers ?locale= over referer and x-locale', () => {
    expect(localeFromRequest(req('https://x.test/api/search?q=iphone&locale=ru', { 'x-locale': 'uk', referer: 'https://x.test/' }))).toBe('ru')
    expect(localeFromRequest(req('https://x.test/api/search?q=iphone&locale=uk', { referer: 'https://x.test/ru/articles' }))).toBe('uk')
  })

  it('uses x-locale when query is absent', () => {
    expect(localeFromRequest(req('https://x.test/api/search?q=iphone', { 'x-locale': 'ru' }))).toBe('ru')
  })

  it('infers ru from a /ru Referer (search box on /ru pages)', () => {
    expect(localeFromRequest(req('https://x.test/api/search?q=iphone', { referer: 'https://x.test/ru/articles' }))).toBe('ru')
    expect(localeFromRequest(req('https://x.test/api/articles', { referer: 'https://x.test/ru' }))).toBe('ru')
  })

  it('defaults to uk when nothing indicates ru', () => {
    expect(localeFromRequest(req('https://x.test/api/search?q=iphone'))).toBe('uk')
    expect(localeFromRequest(req('https://x.test/api/articles', { referer: 'https://x.test/articles' }))).toBe('uk')
  })
})
