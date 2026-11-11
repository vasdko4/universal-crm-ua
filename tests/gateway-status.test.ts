import { describe, it, expect } from 'vitest'
import {
  wfpStatusFromTransaction,
  monoStatusFromInvoice,
  reconcilePendingRefund,
} from '@/lib/payments/clients'

describe('wfpStatusFromTransaction', () => {
  it('maps known WayForPay transaction statuses', () => {
    expect(wfpStatusFromTransaction('Approved')).toBe('paid')
    expect(wfpStatusFromTransaction('Pending')).toBe('pending')
    expect(wfpStatusFromTransaction('InProcessing')).toBe('pending')
    expect(wfpStatusFromTransaction('WaitingAuthComplete')).toBe('pending')
    expect(wfpStatusFromTransaction('Declined')).toBe('failed')
    expect(wfpStatusFromTransaction('Refunded')).toBe('refunded')
    expect(wfpStatusFromTransaction('Voided')).toBe('refunded')
    expect(wfpStatusFromTransaction('Expired')).toBe('expired')
    expect(wfpStatusFromTransaction('RefundInProcessing')).toBe('pending')
  })

  it('returns null for unknown, missing or non-string statuses — never "pending"', () => {
    expect(wfpStatusFromTransaction('SomethingNew')).toBeNull()
    expect(wfpStatusFromTransaction(undefined)).toBeNull()
    expect(wfpStatusFromTransaction(null)).toBeNull()
    expect(wfpStatusFromTransaction(1100)).toBeNull()
    expect(wfpStatusFromTransaction('')).toBeNull()
    // Inherited Object keys must not map: 'constructor' is `in` a plain
    // object but has no entry in the map.
    expect(wfpStatusFromTransaction('constructor')).toBeNull()
    expect(wfpStatusFromTransaction('toString')).toBeNull()
  })
})

describe('monoStatusFromInvoice', () => {
  it('maps known Monobank invoice statuses', () => {
    expect(monoStatusFromInvoice('created')).toBe('pending')
    expect(monoStatusFromInvoice('processing')).toBe('pending')
    expect(monoStatusFromInvoice('hold')).toBe('pending')
    expect(monoStatusFromInvoice('success')).toBe('paid')
    expect(monoStatusFromInvoice('failure')).toBe('failed')
    expect(monoStatusFromInvoice('reversed')).toBe('refunded')
    expect(monoStatusFromInvoice('expired')).toBe('expired')
  })

  it('returns null for unknown, missing or non-string statuses — never "pending"', () => {
    expect(monoStatusFromInvoice('weird')).toBeNull()
    expect(monoStatusFromInvoice(undefined)).toBeNull()
    expect(monoStatusFromInvoice(null)).toBeNull()
    expect(monoStatusFromInvoice(200)).toBeNull()
    expect(monoStatusFromInvoice('constructor')).toBeNull()
  })
})

describe('reconcilePendingRefund', () => {
  it('finalizes when the gateway confirms the refund', () => {
    expect(
      reconcilePendingRefund({ gatewayStatus: 'refunded', pendingAmount: 400, alreadyRefunded: 0, total: 1000 }),
    ).toEqual({ outcome: 'finalized' })
  })

  it('clears a FULL pending refund when the gateway still says paid', () => {
    expect(
      reconcilePendingRefund({ gatewayStatus: 'paid', pendingAmount: 1000, alreadyRefunded: 0, total: 1000 }),
    ).toEqual({ outcome: 'cleared' })
    expect(
      reconcilePendingRefund({ gatewayStatus: 'paid', pendingAmount: 600, alreadyRefunded: 400, total: 1000 }),
    ).toEqual({ outcome: 'cleared' })
  })

  it('keeps a PARTIAL pending refund when the gateway still says paid (cannot disprove it)', () => {
    expect(
      reconcilePendingRefund({ gatewayStatus: 'paid', pendingAmount: 400, alreadyRefunded: 0, total: 1000 }),
    ).toEqual({ outcome: 'unknown' })
    expect(
      reconcilePendingRefund({ gatewayStatus: 'paid', pendingAmount: 100, alreadyRefunded: 400, total: 1000 }),
    ).toEqual({ outcome: 'unknown' })
  })

  it('keeps the reserve on any other gateway answer', () => {
    for (const gatewayStatus of ['pending', 'failed', 'expired', null, undefined]) {
      expect(
        reconcilePendingRefund({ gatewayStatus, pendingAmount: 1000, alreadyRefunded: 0, total: 1000 }),
      ).toEqual({ outcome: 'unknown' })
    }
  })
})
