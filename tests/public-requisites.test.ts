import { describe, expect, it } from 'vitest'
import {
  composeCheckoutNote,
  formatRequisitesNote,
  formatRequisitesPreview,
  publicRequisitesFromConfig,
  requisitesBody,
  splitOrderNote,
} from '@/lib/payments/public-requisites'

describe('publicRequisitesFromConfig', () => {
  it('keeps only the public bank fields', () => {
    expect(
      publicRequisitesFromConfig({
        iban: 'UA123',
        apiKey: 'secret',
        recipientName: 'ТОВ Магазин',
      }),
    ).toEqual({ iban: 'UA123', recipientName: 'ТОВ Магазин' })
  })

  it('returns null when nothing public is set', () => {
    expect(publicRequisitesFromConfig({ apiKey: 'x' })).toBeNull()
  })
})

describe('formatRequisitesPreview', () => {
  it('renders Ukrainian labels and the amount', () => {
    const text = formatRequisitesPreview(
      { iban: 'UA123', recipientName: 'ТОВ Магазин' },
      { amount: 1500, locale: 'uk', orderNumber: '1001' },
    )
    expect(text).toContain('Отримувач: ТОВ Магазин')
    expect(text).toContain('IBAN: UA123')
    expect(text).toContain('оплата замовлення №1001')
    expect(text).toContain('Сума: 1500 ₴')
  })
})

describe('composeCheckoutNote / splitOrderNote', () => {
  it('keeps the shopper comment next to bank requisites', () => {
    const requisites = formatRequisitesNote('IBAN: UA123\nСума: 100 ₴', 'uk')
    const note = composeCheckoutNote(requisites, 'подзвоніть заздалегідь')
    expect(note).toContain('Реквізити для оплати:')
    expect(note).toContain('подзвоніть заздалегідь')
    expect(splitOrderNote(note)).toEqual({
      requisites,
      comment: 'подзвоніть заздалегідь',
    })
    expect(requisitesBody(note)).toBe('IBAN: UA123\nСума: 100 ₴')
  })

  it('does not treat a plain customer note as requisites', () => {
    expect(splitOrderNote('без дзвінка')).toEqual({
      requisites: null,
      comment: 'без дзвінка',
    })
    expect(requisitesBody('без дзвінка')).toBe('')
  })

  it('drops empty parts', () => {
    expect(composeCheckoutNote(undefined, '  ')).toBeNull()
    expect(composeCheckoutNote('Реквізити для оплати:\nIBAN: UA1', null)).toBe(
      'Реквізити для оплати:\nIBAN: UA1',
    )
  })
})
