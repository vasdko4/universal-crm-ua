import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const source = (file: string) => readFileSync(resolve(root, file), 'utf8')

// A3: a repeat checkout landing while the first request is still waiting on
// the gateway invoice used to return { success: true, paymentUrl: undefined }
// — the client showed a thank-you screen with no way to pay. The server now
// waits for the invoice, and the client retries the same idempotency key
// instead of finalizing the order.
describe('A3 — idempotent repeat during the invoice window', () => {
  const shop = source('app/actions/shop.ts')
  const flow = source('components/shop/checkout-flow.tsx')
  const dict = source('lib/i18n/dictionaries.ts')

  it('(a) server never returns success without a URL for an online order', () => {
    // The old unconditional return is gone.
    expect(shop).not.toContain('paymentUrl: pay?.paymentUrl ?? undefined')
    // The invoice is awaited before answering: online orders go through the
    // wait helper, which polls the payments row up to ~12s.
    expect(shop).toContain('waitForInvoicePaymentUrl')
    expect(shop).toContain('IDEMPOTENT_INVOICE_WAIT_MS = 12_000')
    expect(shop).toContain('IDEMPOTENT_INVOICE_POLL_MS = 500')
    expect(shop).toContain("if (existing.paymentMethod === 'online')")
    // The waited URL is what the success payload carries.
    expect(shop).toContain('paymentUrl = waited.url')
  })

  it('(b) the retryable variant exists, is not success, and carries orderNumber', () => {
    expect(shop).toContain('retryable: true')
    expect(shop).toContain('orderNumber: string')
    expect(shop).toContain('{ success: false, retryable: true, orderNumber: existing.orderNumber }')
    // buildIdempotentCheckoutResult can also return null (cancelled
    // mid-poll) so callers fall through to a fresh order.
    expect(shop).toContain('): Promise<CheckoutResult | null> {')
    expect(shop).toContain("if ('cancelled' in waited) return null")
    // Both call sites honor the null (fall through instead of returning).
    const lookup = shop.indexOf('const r = await buildIdempotentCheckoutResult(existing, locale)')
    const winner = shop.indexOf('const r = await buildIdempotentCheckoutResult(winner, locale)')
    expect(lookup).toBeGreaterThan(-1)
    expect(winner).toBeGreaterThan(-1)
    expect(shop.slice(lookup, lookup + 200)).toContain('if (r) return r')
    expect(shop.slice(winner, winner + 200)).toContain('if (r) return r')
  })

  it('(c) client retries the same key and never shows thank-you on retryable', () => {
    // Same idempotency key, retried after ~2s, a few attempts, via the
    // type guard (a let reassigned in the loop does not keep narrowing).
    expect(flow).toContain('RETRYABLE_CHECKOUT_ATTEMPTS = 3')
    expect(flow).toContain('RETRYABLE_CHECKOUT_DELAY_MS = 2000')
    expect(flow).toContain('function isRetryableCheckoutResult')
    expect(flow).toContain('const submitOnce = () =>')
    expect(flow).toContain('while (isRetryableCheckoutResult(res) && retryCount < RETRYABLE_CHECKOUT_ATTEMPTS)')
    expect(flow).toContain('setPaymentLinkPending({ orderNumber: res.orderNumber })')
    expect(flow).toContain('setPaymentLinkPending({ orderNumber: finalRes.orderNumber })')
    // Retries exhausted: the waiting panel stays, the cart is NOT cleared
    // and setDone is NOT reached from the retryable branch.
    const retryBranch = flow.indexOf('// Retries exhausted')
    const setDone = flow.indexOf('setDone(res)')
    expect(retryBranch).toBeGreaterThan(-1)
    expect(setDone).toBeGreaterThan(retryBranch)
    expect(flow.slice(retryBranch, setDone)).toContain('return')
    // The waiting panel shows the "link is being created" state and a
    // fallback link to the pay page (which polls the payment status).
    expect(flow).toContain('if (paymentLinkPending)')
    expect(flow).toContain('t.paymentLinkCreating')
    expect(flow).toContain('t.paymentLinkCreatingDesc')
    expect(flow).toContain('t.goToPaymentPage')
    expect(flow).toContain('`/checkout/pay/${paymentLinkPending.orderNumber}`')
    // The pending state is cleared before the normal success path proceeds.
    const clearPending = flow.indexOf('setPaymentLinkPending(null)')
    expect(clearPending).toBeGreaterThan(-1)
    expect(clearPending).toBeLessThan(setDone)
  })

  it('i18n keys for the waiting panel exist in both locales', () => {
    for (const key of ['paymentLinkCreating', 'paymentLinkCreatingDesc', 'goToPaymentPage']) {
      expect(dict).toContain(`${key}: string`)
      expect(dict).toContain(`${key}: '`)
    }
    expect(dict).toContain('Створюємо посилання на оплату')
    expect(dict).toContain('Создаём ссылку на оплату')
  })

  it('one-click checkout is untouched (COD-only, no paymentUrl)', () => {
    // The fix is scoped to createStorefrontOrder / CheckoutFlow; one-click
    // has its own result type and no retryable variant.
    expect(shop).toContain('export type OneClickOrderResult')
    const oneClick = shop.slice(shop.indexOf('export type OneClickOrderResult'))
    expect(oneClick).not.toContain('retryable')
  })
})
