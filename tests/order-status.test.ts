import { describe, it, expect } from 'vitest'
import {
  getOrderStatusLabel,
  getPaymentStatusLabel,
  ORDER_STATUSES,
  isOrderStatusTransitionAllowed,
} from '@/lib/order-status'

describe('admin order status labels default to uk', () => {
  it('uses Ukrainian for uk (and as the ORDER_STATUSES source of truth)', () => {
    expect(getOrderStatusLabel('new', 'uk')).toBe('Новий')
    expect(getOrderStatusLabel('shipped', 'uk')).toBe('Відправлено')
    expect(ORDER_STATUSES.find((s) => s.value === 'new')?.label).toBe('Новий')
    expect(getPaymentStatusLabel('paid', 'uk')).toBe('Сплачено')
    expect(getPaymentStatusLabel('unpaid', 'uk')).toBe('Очікує оплати')
  })

  it('still has Russian when the admin locale is ru', () => {
    expect(getOrderStatusLabel('new', 'ru')).toBe('Новый')
    expect(getOrderStatusLabel('shipped', 'ru')).toBe('Отправлен')
    expect(getPaymentStatusLabel('paid', 'ru')).toBe('Оплачен')
    expect(getPaymentStatusLabel('unpaid', 'ru')).toBe('Ожидает оплаты')
  })
})

describe('order status transition matrix', () => {
  it('allows forward steps and reopen, blocks the nonsensical ones', () => {
    // Forward along the pipeline, skipping steps is fine.
    expect(isOrderStatusTransitionAllowed('new', 'shipped')).toBe(true)
    expect(isOrderStatusTransitionAllowed('processing', 'done')).toBe(true)
    // Payment and cancel out of pending_payment.
    expect(isOrderStatusTransitionAllowed('pending_payment', 'new')).toBe(true)
    expect(isOrderStatusTransitionAllowed('pending_payment', 'cancelled')).toBe(true)
    // Reopen a cancelled order.
    expect(isOrderStatusTransitionAllowed('cancelled', 'new')).toBe(true)
    // Skipping payment is not allowed.
    expect(isOrderStatusTransitionAllowed('pending_payment', 'shipped')).toBe(false)
    expect(isOrderStatusTransitionAllowed('pending_payment', 'done')).toBe(false)
    // Done is terminal; nothing goes back to pending_payment.
    expect(isOrderStatusTransitionAllowed('done', 'new')).toBe(false)
    expect(isOrderStatusTransitionAllowed('new', 'pending_payment')).toBe(false)
    // Cancelled goes nowhere except reopen.
    expect(isOrderStatusTransitionAllowed('cancelled', 'shipped')).toBe(false)
    expect(isOrderStatusTransitionAllowed('cancelled', 'done')).toBe(false)
    // Unknown statuses are never allowed.
    expect(isOrderStatusTransitionAllowed('bogus', 'new')).toBe(false)
  })
})
