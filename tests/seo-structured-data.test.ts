import { describe, it, expect } from 'vitest'
import { resolveOgImageUrl, buildBreadcrumbLd, buildFaqPageLd } from '@/lib/seo'

const ORIGIN = 'https://shop.example.com'

describe('resolveOgImageUrl', () => {
  it('prefers the page image, resolved against the origin', () => {
    expect(resolveOgImageUrl(ORIGIN, '/img/category.png', '/store-og.png')).toBe(
      'https://shop.example.com/img/category.png',
    )
  })

  it('falls back to the store-wide OG image when the page has none', () => {
    expect(resolveOgImageUrl(ORIGIN, null, '/store-og.png')).toBe(
      'https://shop.example.com/store-og.png',
    )
  })

  it('falls back to the stock hero when neither is set', () => {
    expect(resolveOgImageUrl(ORIGIN, null, null)).toBe(
      'https://shop.example.com/hero-electronics.png',
    )
  })

  it('treats a blank page image as missing', () => {
    expect(resolveOgImageUrl(ORIGIN, '   ', '/store-og.png')).toBe(
      'https://shop.example.com/store-og.png',
    )
  })

  it('passes absolute URLs through unchanged', () => {
    const abs = 'https://cdn.example.com/og.png'
    expect(resolveOgImageUrl(ORIGIN, abs, '/store-og.png')).toBe(abs)
  })

  it('routes marketplace CDN images through the same-origin proxy', () => {
    const out = resolveOgImageUrl(ORIGIN, 'https://images.prom.ua/123_755_w700_h500_photo.jpg', null)
    expect(out.startsWith(`${ORIGIN}/api/media?src=`)).toBe(true)
    // The visible host must be our own origin; the marketplace URL only
    // appears URL-encoded inside the src query parameter.
    expect(new URL(out).hostname).toBe('shop.example.com')
  })
})

describe('buildBreadcrumbLd', () => {
  it('builds a BreadcrumbList with sequential positions and absolute items', () => {
    const ld = buildBreadcrumbLd(
      [
        { name: 'Головна', path: '/' },
        { name: 'Каталог', path: '/catalog' },
        { name: 'Телефони', path: '/category/7' },
      ],
      ORIGIN,
    )
    expect(ld).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Головна', item: 'https://shop.example.com/' },
        { '@type': 'ListItem', position: 2, name: 'Каталог', item: 'https://shop.example.com/catalog' },
        { '@type': 'ListItem', position: 3, name: 'Телефони', item: 'https://shop.example.com/category/7' },
      ],
    })
  })

  it('handles a single crumb', () => {
    const ld = buildBreadcrumbLd([{ name: 'Головна', path: '/' }], ORIGIN)
    expect(ld.itemListElement).toHaveLength(1)
    expect(ld.itemListElement[0].position).toBe(1)
  })
})

describe('buildFaqPageLd', () => {
  it('builds a FAQPage from answered questions', () => {
    const ld = buildFaqPageLd([
      { question: 'Чи є гарантія?', answer: 'Так, 12 місяців.' },
      { question: 'Яка доставка?', answer: 'Нова Пошта, 1–3 дні.' },
    ])
    expect(ld).toEqual({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Чи є гарантія?',
          acceptedAnswer: { '@type': 'Answer', text: 'Так, 12 місяців.' },
        },
        {
          '@type': 'Question',
          name: 'Яка доставка?',
          acceptedAnswer: { '@type': 'Answer', text: 'Нова Пошта, 1–3 дні.' },
        },
      ],
    })
  })

  it('skips unanswered and blank questions', () => {
    const ld = buildFaqPageLd([
      { question: 'Answered?', answer: 'Yes.' },
      { question: 'Pending?', answer: null },
      { question: '   ', answer: 'No question text.' },
    ])
    expect(ld?.mainEntity).toHaveLength(1)
    expect(ld?.mainEntity[0].name).toBe('Answered?')
  })

  it('returns null when nothing is renderable', () => {
    expect(buildFaqPageLd([])).toBeNull()
    expect(buildFaqPageLd([{ question: 'Q?', answer: null }])).toBeNull()
  })
})
