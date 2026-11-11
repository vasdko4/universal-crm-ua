import crypto from 'node:crypto'
import { describe, it, expect } from 'vitest'
import {
  wfpStatusFromTransaction,
  monoStatusFromInvoice,
  reconcilePendingRefund,
  wayforpayVerifyCallback,
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

describe('wayforpayVerifyCallback', () => {
  // Signs a callback body exactly like WayForPay does (HMAC-MD5 over the
  // documented fields joined with ';'), so `valid` is true and only the
  // status mapping is under test.
  const sign = (secret: string, body: Record<string, unknown>) => {
    const s = (k: string) => (body[k] == null ? '' : String(body[k]))
    const signature = crypto
      .createHmac('md5', secret)
      .update(
        [
          s('merchantAccount'),
          s('orderReference'),
          s('amount'),
          s('currency'),
          s('authCode'),
          s('cardPan'),
          s('transactionStatus'),
          s('reasonCode'),
        ].join(';'),
        'utf8',
      )
      .digest('hex')
    return { ...body, merchantSignature: signature }
  }

  const base = {
    merchantAccount: 'test_merch_n1',
    orderReference: '123456789012',
    amount: 100,
    currency: 'UAH',
    authCode: '123456',
    cardPan: '411111******1111',
    reasonCode: '1100',
  }

  it('maps known statuses and verifies the signature', () => {
    const approved = wayforpayVerifyCallback('secret', sign('secret', { ...base, transactionStatus: 'Approved' }))
    expect(approved.valid).toBe(true)
    expect(approved.status).toBe('paid')
    expect(approved.orderReference).toBe('123456789012')
    const pending = wayforpayVerifyCallback('secret', sign('secret', { ...base, transactionStatus: 'Pending' }))
    expect(pending.valid).toBe(true)
    expect(pending.status).toBe('pending')
    const declined = wayforpayVerifyCallback('secret', sign('secret', { ...base, transactionStatus: 'Declined' }))
    expect(declined.status).toBe('failed')
  })

  it('yields undefined — never "pending" — for garbage or missing statuses', () => {
    const garbage = wayforpayVerifyCallback('secret', sign('secret', { ...base, transactionStatus: 'SomethingNew' }))
    expect(garbage.valid).toBe(true)
    expect(garbage.status).toBeUndefined()
    expect(garbage.transactionStatus).toBe('SomethingNew')
    const missing = wayforpayVerifyCallback('secret', sign('secret', { ...base }))
    expect(missing.valid).toBe(true)
    expect(missing.status).toBeUndefined()
  })

  it('rejects a bad signature', () => {
    const result = wayforpayVerifyCallback('secret', { ...base, transactionStatus: 'Approved', merchantSignature: 'deadbeef' })
    expect(result.valid).toBe(false)
  })
})
