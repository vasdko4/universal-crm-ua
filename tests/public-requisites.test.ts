import { describe, expect, it } from 'vitest'
import {
  composeCheckoutNote,
  formatRequisitesNote,
  formatRequisitesPreview,
  localizeRequisitesBody,
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

describe('localizeRequisitesBody', () => {
  const cfg = {
    recipientName: 'ФОП Іваненко',
    edrpou: '1234567890',
    iban: 'UA123456789',
    cardNumber: '4111 1111 1111 1111',
  }
  it('re-renders RU labels in Ukrainian without touching values', () => {
    const ru = formatRequisitesPreview(cfg, { amount: 1500, locale: 'ru', orderNumber: '41' })
    const uk = localizeRequisitesBody(ru, 'uk')
    expect(uk).toContain('Отримувач: ФОП Іваненко')
    expect(uk).toContain('ЄДРПОУ/ІПН: 1234567890')
    expect(uk).toContain('IBAN: UA123456789')
    expect(uk).toContain('Картка: 4111 1111 1111 1111')
    expect(uk).toContain('Призначення платежу: оплата замовлення №41')
    expect(uk).toContain('Сума: 1500 ₴')
    expect(uk).not.toContain('Получатель')
  })

  it('re-renders UK labels in Russian', () => {
    const uk = formatRequisitesPreview(cfg, { amount: 1500, locale: 'uk', orderNumber: '41' })
    const ru = localizeRequisitesBody(uk, 'ru')
    expect(ru).toContain('Получатель: ФОП Іваненко')
    expect(ru).toContain('Назначение платежа: оплата заказа №41')
    expect(ru).toContain('Сумма: 1500 ₴')
  })

  it('leaves unknown lines untouched', () => {
    expect(localizeRequisitesBody('IBAN: UA1\nДовільний рядок без мітки', 'ru')).toBe(
      'IBAN: UA1\nДовільний рядок без мітки',
    )
  })
})
