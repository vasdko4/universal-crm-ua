import { describe, expect, it } from 'vitest'
import {
  formatRequisitesPreview,
  publicRequisitesFromConfig,
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
    expect(text).toContain('Сума: 1500 грн')
  })
})
