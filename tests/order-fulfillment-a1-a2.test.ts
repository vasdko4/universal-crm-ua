import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const source = (file: string) => readFileSync(resolve(root, file), 'utf8')

// A1: a paid order must never get stuck in pending_payment because the promo
// limit was exhausted between checkout and payment confirmation.
describe('A1: finalize is non-strict on promo (paid order never stuck)', () => {
  const fulfillment = source('lib/shop/order-fulfillment.ts')

  it('applyOrderFulfillment accepts a strictPromo override', () => {
    expect(fulfillment).toContain('opts?: { strictStock?: boolean; strictPromo?: boolean }')
    expect(fulfillment).toContain('{ strict: opts?.strictPromo ?? client != null }')
  })

  it('claimAndFulfillPaidOrder passes strictPromo: false', () => {
    expect(fulfillment).toContain('await applyOrderFulfillment(orderId, client, { strictPromo: false })')
  })

  it('checkout stays strict by default (no strictPromo passed at checkout)', () => {
    // Default `opts?.strictPromo ?? client != null` is true whenever a
    // transaction client is present — all checkout call sites pass one.
    expect(fulfillment).toContain('{ strict: opts?.strictPromo ?? client != null }')
    const shop = source('app/actions/shop.ts')
    expect(shop).not.toContain('strictPromo')
  })

  it('the non-strict branch logs the miss to order history instead of throwing', () => {
    const promo = source('lib/shop/promo-usage.ts')
    expect(promo).toContain("if (!usage.counted && strict) throw new Error('promo-limit')")
    // The history insert runs for both branches — uncounted + non-strict
    // lands here instead of the throw above.
    expect(promo).toContain('не засчитан: лимит исчерпан')
    expect(promo).toContain('не засчитана: лимит исчерпан')
  })

  it('the misleading comments are fixed', () => {
    expect(fulfillment).not.toContain('Online (no client)')
    expect(fulfillment).not.toContain('intentionally stays non-strict')
  })

  it('settlePayment alerts the admin on a finalize failure and rethrows', () => {
    const settle = source('lib/payments/settle.ts')
    expect(settle).toContain("await reportError('payments.settle-finalize', e, {")
    expect(settle).toContain('alertAdmin: true')
    // The rethrow keeps the gateway retry (webhook answers 500).
    const finalizeAt = settle.indexOf('await finalizePaidOrder(orderReference)')
    const rethrowAt = settle.indexOf('throw e', finalizeAt)
    const ga4At = settle.indexOf('reportGa4Purchase', finalizeAt)
    expect(finalizeAt).toBeGreaterThan(-1)
    expect(rethrowAt).toBeGreaterThan(finalizeAt)
    expect(rethrowAt).toBeLessThan(ga4At)
  })
})

// A2: stats writes must run on the transaction executor, not the pool.
describe('A2: stats writes use the transaction executor', () => {
  const fulfillment = source('lib/shop/order-fulfillment.ts')
  const statsStart = fulfillment.indexOf('Customer stats / analytics')
  const statsEnd = fulfillment.indexOf('The claim + fulfillment half', statsStart)
  const stats = fulfillment.slice(statsStart, statsEnd)

  it('runs the customers update and the analytics insert on q, not pool', () => {
    expect(stats).toContain('UPDATE customers SET orders_count')
    expect(stats).toContain('INSERT INTO analytics_events')
    expect(stats).toContain('await q.query(')
    expect(stats).not.toContain('pool.query')
  })

  it('no longer swallows errors silently — failures are logged', () => {
    expect(stats).not.toContain('.catch(() => {})')
    expect(stats).toContain("console.error('[fulfillment] customer stats update failed'")
    expect(stats).toContain("console.error('[fulfillment] analytics event insert failed'")
  })
})

// A1 (expire-pending cascade): one stuck order must not abort the daily run.
describe('expire-pending continues past a failing order', () => {
  const src = source('lib/payments/expire-pending.ts')

  it('wraps the per-order body in try/catch that reports and continues', () => {
    const loopAt = src.indexOf('for (const row of rows) {')
    const tryAt = src.indexOf('try {', loopAt)
    const catchAt = src.indexOf("} catch (e) {", tryAt)
    const reportAt = src.indexOf("await reportError('cron.expire-pending-order', e,", catchAt)
    const returnAt = src.indexOf('return { probed:', catchAt)
    expect(loopAt).toBeGreaterThan(-1)
    expect(tryAt).toBeGreaterThan(loopAt)
    expect(catchAt).toBeGreaterThan(tryAt)
    expect(reportAt).toBeGreaterThan(catchAt)
    expect(reportAt).toBeLessThan(returnAt)
    // The settle calls and the cancel claim live inside the try.
    expect(src.indexOf('await settlePayment(row.order_number', loopAt)).toBeGreaterThan(tryAt)
    expect(src.indexOf('await settlePayment(row.order_number', loopAt)).toBeLessThan(catchAt)
  })

  it('keeps the no-cancel-on-failed-probe behavior', () => {
    expect(src).toContain('if (!result.ok || !result.status) continue')
  })
})
