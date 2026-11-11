import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { hasPendingRefund } from '@/components/payments/pending-refund'

const root = resolve(import.meta.dirname, '..')
const source = (file: string) => readFileSync(resolve(root, file), 'utf8')

function payment(overrides: { status: string; pendingRefundAmount: string | number }) {
  return { status: overrides.status, pendingRefundAmount: overrides.pendingRefundAmount }
}

describe('hasPendingRefund', () => {
  it('shows the badge while a refund is reserved on a paid payment', () => {
    expect(hasPendingRefund(payment({ status: 'paid', pendingRefundAmount: '150.50' }))).toBe(true)
  })

  it('shows the badge on a partially refunded payment with a pending remainder', () => {
    expect(hasPendingRefund(payment({ status: 'partially_refunded', pendingRefundAmount: 25 }))).toBe(
      true,
    )
  })

  it('never shows the badge on a fully refunded payment, even with a nonzero reserve', () => {
    expect(hasPendingRefund(payment({ status: 'refunded', pendingRefundAmount: '100.00' }))).toBe(
      false,
    )
  })

  it('hides the badge when nothing is reserved', () => {
    expect(hasPendingRefund(payment({ status: 'paid', pendingRefundAmount: '0' }))).toBe(false)
    expect(hasPendingRefund(payment({ status: 'paid', pendingRefundAmount: '0.00' }))).toBe(false)
    expect(hasPendingRefund(payment({ status: 'paid', pendingRefundAmount: 0 }))).toBe(false)
  })
})

describe('refund pending badge (source-level)', () => {
  it('payments list renders the pending badge next to the status', () => {
    const src = source('components/payments/payments-manager.tsx')
    expect(src).toContain('hasPendingRefund(p)')
    expect(src).toContain('t.payments.refundPendingPrefix')
    expect(src).toContain('money(Number(p.pendingRefundAmount), p.currency, locale)')
    expect(src).toContain('p.pendingRefundAt')
  })

  it('i18n keys exist in both admin dictionaries', () => {
    const dict = source('lib/i18n/admin/dictionaries.ts')
    expect(dict).toContain('refundPendingPrefix: string')
    expect(dict).toContain("refundPendingPrefix: 'очікується повернення'")
    expect(dict).toContain("refundPendingPrefix: 'ожидается возврат'")
  })
})
