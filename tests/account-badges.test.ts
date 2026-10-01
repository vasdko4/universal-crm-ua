import { describe, it, expect } from 'vitest'
import { ORDER_STATUSES } from '@/lib/order-status'
import { orderStatusBadgeClass, paymentStatusBadgeClass } from '@/components/shop/account/order-status-badge'

describe('orderStatusBadgeClass', () => {
  it('returns a color class for every known order status', () => {
    for (const s of ORDER_STATUSES) {
      const cls = orderStatusBadgeClass(s.value)
      expect(cls).toContain('bg-')
      expect(cls).toContain('text-')
    }
  })

  it('maps key statuses to their documented colors', () => {
    expect(orderStatusBadgeClass('done')).toContain('emerald')
    expect(orderStatusBadgeClass('cancelled')).toContain('red')
    expect(orderStatusBadgeClass('new')).toContain('blue')
    expect(orderStatusBadgeClass('shipped')).toContain('cyan')
  })

  it('falls back to a neutral class for unknown statuses', () => {
    const cls = orderStatusBadgeClass('some_future_status')
    expect(cls).toContain('bg-muted')
  })
})

describe('paymentStatusBadgeClass', () => {
  it('maps known payment statuses to colors', () => {
    expect(paymentStatusBadgeClass('paid')).toContain('emerald')
    expect(paymentStatusBadgeClass('unpaid')).toContain('amber')
    expect(paymentStatusBadgeClass('partially_refunded')).toContain('blue')
    expect(paymentStatusBadgeClass('refunded')).toContain('bg-muted')
  })

  it('falls back to a neutral class for unknown statuses', () => {
    expect(paymentStatusBadgeClass('bogus')).toContain('bg-muted')
  })
})
