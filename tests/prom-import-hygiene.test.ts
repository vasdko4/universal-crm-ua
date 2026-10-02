import { describe, expect, it } from 'vitest'
import { cleanUkrainianDescription, findCapacityMismatch } from '@/lib/prom-import/hygiene'

describe('cleanUkrainianDescription', () => {
  it('replaces standalone Russian words with Ukrainian equivalents', () => {
    const { html, fixedWords } = cleanUkrainianDescription(
      '<p>Заряджання через <strong>Micro-USB или USB-C</strong> и двома виходами. Уже в продажу.</p>',
    )
    expect(html).toContain('або')
    expect(html).toContain(' і двома')
    expect(html).toContain('Вже в продажу')
    expect(html).not.toContain('или')
    expect(fixedWords.sort()).toEqual(['и', 'или', 'уже'])
  })

  it('preserves first-letter capitalization', () => {
    const { html } = cleanUkrainianDescription('<p>И так, Или иначе. Уже.</p>')
    expect(html).toContain('І так')
    expect(html).toContain('Або иначе')
    expect(html).toContain('Вже.')
  })

  it('does not touch substrings inside other words', () => {
    const src = '<p>Міксер навесні зможете. Цветок.</p>'
    const { html, fixedWords } = cleanUkrainianDescription(src)
    // "Цветок" (flower) must not become "Колірoк"
    expect(html).toContain('Цветок')
    expect(fixedWords).toEqual([])
  })

  it('fixes color and rear adjectives', () => {
    const { html } = cleanUkrainianDescription('<li>Цвет: рожевий</li><li>Гальмо: задний</li>')
    expect(html).toContain('Колір: рожевий')
    // Dictionary masculine form; grammatical agreement with neuter nouns
    // ("Гальмо: заднє") stays a human touch-up.
    expect(html).toContain('задній')
  })

  it('never breaks HTML tags or attributes', () => {
    const src = '<a href="https://example.com/ili" class="x">или</a>'
    const { html } = cleanUkrainianDescription(src)
    expect(html).toContain('href="https://example.com/ili"')
    expect(html).toContain('>або</a>')
  })

  it('handles empty input', () => {
    expect(cleanUkrainianDescription('')).toEqual({ html: '', fixedWords: [] })
  })
})

describe('findCapacityMismatch', () => {
  it('flags title/body mAh contradiction', () => {
    const res = findCapacityMismatch(
      'Павербанк Hoco 30000 mAh',
      '<p>Акумулятор місткістю 20 000 мАч</p>',
    )
    expect(res).toEqual({ titleMah: '30000', bodyMah: ['20000'] })
  })

  it('accepts spaced numbers that agree', () => {
    expect(
      findCapacityMismatch('Hoco 30000 mAh', '<p>Місткість 30 000 мАч</p>'),
    ).toBeNull()
  })

  it('accepts the Latin mAh spelling in the body', () => {
    expect(findCapacityMismatch('Hoco 30000 mAh', '<p>30000 mAh battery</p>')).toBeNull()
  })

  it('returns null when there is nothing to compare', () => {
    expect(findCapacityMismatch('Ролики Scale', '<p>Гарні ролики</p>')).toBeNull()
    expect(findCapacityMismatch('Hoco 30000 mAh', '<p>Без цифр</p>')).toBeNull()
    expect(findCapacityMismatch(null, '<p>20000 мАч</p>')).toBeNull()
    expect(findCapacityMismatch('Hoco 30000 mAh', null)).toBeNull()
  })

  it('is repeatable (no lastIndex leakage between calls)', () => {
    const args = ['Hoco 30000 mAh', '<p>20 000 мАч</p>'] as const
    const first = findCapacityMismatch(...args)
    const second = findCapacityMismatch(...args)
    expect(second).toEqual(first)
    expect(first).not.toBeNull()
  })
})
