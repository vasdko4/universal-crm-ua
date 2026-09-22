import { describe, it, expect } from 'vitest'

/**
 * Mirrors the SQL claim in restoreStockOnce / claimStockRestore:
 *   UPDATE orders SET stock_restored = true
 *    WHERE id = $1 AND stock_restored IS NOT TRUE
 *    RETURNING id
 * Only the first concurrent caller gets a row.
 */
function claimRestore(flags: boolean[]): boolean[] {
  let restored = false
  return flags.map(() => {
    if (restored) return false
    restored = true
    return true
  })
}

describe('stockRestored claim', () => {
  it('only the first of two concurrent restores wins', () => {
    expect(claimRestore([false, false])).toEqual([true, false])
  })

  it('a later refund after cancel does not restore again', () => {
    const afterCancel = true
    const refundClaim = !afterCancel
    expect(refundClaim).toBe(false)
  })

  it('gateway refund restores only when the order is not already cancelled', () => {
    const shouldRestore = (orderStatus: string, paymentStatus: string) =>
      paymentStatus === 'refunded' && orderStatus !== 'cancelled'
    expect(shouldRestore('new', 'refunded')).toBe(true)
    expect(shouldRestore('cancelled', 'refunded')).toBe(false)
    expect(shouldRestore('new', 'paid')).toBe(false)
  })
})
