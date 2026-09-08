import { describe, it, expect } from 'vitest'
import { getOrderStatusLabel, getPaymentStatusLabel, ORDER_STATUSES } from '@/lib/order-status'

describe('admin order status labels default to uk', () => {
  it('uses Ukrainian for uk (and as the ORDER_STATUSES source of truth)', () => {
    expect(getOrderStatusLabel('new', 'uk')).toBe('Новий')
    expect(getOrderStatusLabel('shipped', 'uk')).toBe('Відправлено')
    expect(ORDER_STATUSES.find((s) => s.value === 'new')?.label).toBe('Новий')
    expect(getPaymentStatusLabel('paid', 'uk')).toBe('Оплачено')
  })

  it('still has Russian when the admin locale is ru', () => {
    expect(getOrderStatusLabel('new', 'ru')).toBe('Новый')
    expect(getOrderStatusLabel('shipped', 'ru')).toBe('Отправлен')
    expect(getPaymentStatusLabel('paid', 'ru')).toBe('Оплачен')
  })
})
