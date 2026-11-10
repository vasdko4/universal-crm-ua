import { describe, it, expect } from 'vitest'
import { trimFeedTitle, FEED_TITLE_MAX } from '@/lib/shop/feed-title'

describe('trimFeedTitle', () => {
  it('leaves a short name as-is', () => {
    expect(trimFeedTitle('Коротка назва товару')).toBe('Коротка назва товару')
  })

  it('cuts a long Ukrainian name at a word boundary', () => {
    expect(
      trimFeedTitle('Зарядний пристрій для автомобільного акумулятора 12V 10A для літій-залізофосфатних акумуляторів'),
    ).toBe('Зарядний пристрій для автомобільного акумулятора 12V 10A для')
  })

  it('cuts a long mixed-language name at a word boundary', () => {
    expect(
      trimFeedTitle(
        'Мережевий зарядний пристрій з кабелем ACEFAST A118 PD30W mini GaN USB-C fast charger set (P16) Black',
      ),
    ).toBe('Мережевий зарядний пристрій з кабелем ACEFAST A118 PD30W mini GaN')
  })

  it('never exceeds the limit and never ends mid-word', () => {
    const out = trimFeedTitle(
      'Мережевий зарядний пристрій з кабелем ACEFAST A118 PD30W mini GaN USB-C fast charger set (P16) Black',
    )
    expect(out!.length).toBeLessThanOrEqual(FEED_TITLE_MAX)
    expect(out).not.toMatch(/ $/)
  })

  it('hard-cuts a single long word', () => {
    const out = trimFeedTitle('A'.repeat(80))
    expect(out).toBe('A'.repeat(70))
  })

  it('collapses whitespace', () => {
    expect(trimFeedTitle('  spaced   out   name  ')).toBe('spaced out name')
  })

  it('returns null for a blank name', () => {
    expect(trimFeedTitle('')).toBeNull()
    expect(trimFeedTitle('   ')).toBeNull()
    expect(trimFeedTitle(null)).toBeNull()
    expect(trimFeedTitle(undefined)).toBeNull()
  })
})
