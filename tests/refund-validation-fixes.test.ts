import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { refundPlan } from '@/lib/payments/refund'
import { toIntInRange } from '@/lib/shop/checkout-validation'

const root = resolve(import.meta.dirname, '..')
const source = (file: string) => readFileSync(resolve(root, file), 'utf8')
const count = (text: string, needle: string) => text.split(needle).length - 1

describe('refundPlan', () => {
  it('refunds the full remainder when no amount is requested', () => {
    expect(refundPlan(1000, 0)).toEqual({
      ok: true,
      amount: 1000,
      newRefunded: 1000,
      status: 'refunded',
    })
    expect(refundPlan(1000, 200)).toEqual({
      ok: true,
      amount: 800,
      newRefunded: 1000,
      status: 'refunded',
    })
  })

  it('refunds exactly the requested amount when valid', () => {
    expect(refundPlan(1000, 200, 300)).toEqual({
      ok: true,
      amount: 300,
      newRefunded: 500,
      status: 'partially_refunded',
    })
  })

  it('rejects an invalid requested amount instead of refunding the remainder', () => {
    expect(refundPlan(1000, 0, 0)).toEqual({ ok: false, error: 'invalid' })
    expect(refundPlan(1000, 0, -50)).toEqual({ ok: false, error: 'invalid' })
    expect(refundPlan(1000, 0, Number.NaN)).toEqual({ ok: false, error: 'invalid' })
    expect(refundPlan(1000, 0, Infinity)).toEqual({ ok: false, error: 'invalid' })
  })

  it('still rejects amounts above the total', () => {
    expect(refundPlan(1000, 900, 200)).toEqual({ ok: false, error: 'exceeds' })
  })
})

describe('toIntInRange', () => {
  it('rejects fractions instead of flooring them', () => {
    expect(toIntInRange(1.9, 1, 10)).toBeNull()
    expect(toIntInRange('2.5', 1, 10)).toBeNull()
  })

  it('accepts integers and integer strings', () => {
    expect(toIntInRange(5, 1, 10)).toBe(5)
    expect(toIntInRange('2', 1, 10)).toBe(2)
  })

  it('rejects NaN, Infinity and out-of-range values', () => {
    expect(toIntInRange(Number.NaN, 1, 10)).toBeNull()
    expect(toIntInRange(Infinity, 1, 10)).toBeNull()
    expect(toIntInRange(0, 1, 10)).toBeNull()
    expect(toIntInRange(11, 1, 10)).toBeNull()
  })
})

describe('audit small fixes (source-level)', () => {
  it('getPromotions normalizes page/pageSize and rejects infinite discounts', () => {
    const src = source('app/actions/promotions.ts')
    expect(src).toContain('normalizeCatalogPaging(params.page, params.pageSize ?? 8)')
    expect(src).toContain('Number.isFinite(input.discountValue)')
  })

  it('product validation rejects infinite prices', () => {
    const src = source('app/actions/products.ts')
    expect(src).toContain('if (!Number.isFinite(price) || price < 0)')
    expect(src).toContain('Number.isFinite(Number(input.oldPrice))')
    expect(src).toContain('return Number.isFinite(n) && n >= 0')
  })

  it('category/group/page toggles and deletes check the affected row', () => {
    const categories = source('app/actions/categories.ts')
    // updateCategory (existence pre-check for the stable slug + the
    // returning() check) + toggleCategoryVisibility + deleteCategory.
    expect(count(categories, 'Категория не найдена')).toBe(4)
    expect(count(categories, '.returning({ id: categories.id })')).toBe(3)
    const groups = source('app/actions/groups.ts')
    // updateGroup + toggleGroupActive + deleteGroup (3.4.76).
    expect(count(groups, 'Группа не найдена')).toBe(3)
    expect(count(groups, '.returning({ id: productGroups.id })')).toBe(3)
    const pages = source('app/actions/pages.ts')
    // togglePageStatus + deletePage (updatePage already checked existence).
    expect(count(pages, 'Страница не найдена')).toBe(3)
    expect(count(pages, '.returning({ id: pages.id })')).toBe(2)
  })

  it('refundPayment reports an invalid requested amount', () => {
    expect(source('app/actions/payments.ts')).toContain('Некорректная сумма возврата')
  })

  it('verification flows report a failed email send instead of success', () => {
    expect(count(source('app/actions/shop-auth.ts'), 'if (!sent.sent)')).toBe(3)
  })

  it('admin order creation requires the payments right for financial statuses', () => {
    expect(source('app/actions/orders.ts')).toContain(
      "if (input.paymentStatus != null && input.paymentStatus !== 'unpaid') {",
    )
  })

  it('CSP img-src allows the gtag remarketing pixel from google.no', () => {
    const imgSrc = source('proxy.ts')
    expect(imgSrc).toContain('https://*.google.no')
    expect(imgSrc).toContain('https://www.googleadservices.com')
  })
})

describe('audit 19: refund reserve rollback is versioned, ambiguous answers stay reserved', () => {
  const src = source('app/actions/payments.ts')

  it('rolls the reserve back only when the row still holds the reserved values', () => {
    // 3.4.87: the reserve moved to pending_refund_amount (two-phase ledger) —
    // the versioned rollback is now a CAS on the pending marker, so a
    // concurrent reconcile that already finalized it is never clobbered.
    expect(src).toContain('rollbackReserve')
    expect(src).toContain('WHERE id = $1 AND pending_refund_amount = $2')
    // No blind rollback left: the old unconditional UPDATEs are gone.
    expect(count(src, 'updated_at = NOW() WHERE id = $1`')).toBe(0)
    expect(count(src, 'await rollbackReserve()')).toBe(3)
  })

  it('never rolls back on an ambiguous gateway answer', () => {
    expect(src).toContain('ambiguous: true')
    expect(src).toContain('проверьте в кабинете шлюза перед повтором')
  })

  it('a logging failure does not drop the order-side updates', () => {
    expect(src).toContain('[refundPayment] logEvent failed')
  })
})
