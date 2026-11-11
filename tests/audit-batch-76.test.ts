import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const source = (file: string) => readFileSync(resolve(root, file), 'utf8')
const count = (text: string, needle: string) => text.split(needle).length - 1

describe('audit batch 3.4.76 (source-level)', () => {
  it('cron jobs fail closed on a DB error', () => {
    const src = source('lib/cron/store.ts')
    expect(src).toContain('Fail closed')
    // isCronJobEnabled: the catch branch must not re-enable a disabled job.
    const fn = src.slice(src.indexOf('export async function isCronJobEnabled'))
    const body = fn.slice(0, fn.indexOf('export async function setCronJobEnabled'))
    // A missing row (first run) still defaults to enabled; a DB error must not.
    expect(body).toContain('if (rows.length === 0) return true')
    expect(body.slice(body.indexOf('} catch {'))).toContain('return false')
  })

  it('WayForPay callback caps the body before the signature check', () => {
    const src = source('app/api/payments/wayforpay/callback/route.ts')
    expect(src).toContain('MAX_CALLBACK_BYTES')
    expect(src).toContain("status: 413")
    expect(src.indexOf('MAX_CALLBACK_BYTES')).toBeLessThan(src.indexOf('await req.text()'))
  })

  it('at most one default address per user is enforced by a partial unique index', () => {
    const sql = source('db/migrate.sql')
    expect(sql).toContain('idx_user_addresses_one_default_per_user')
    expect(sql).toContain('ON "user_addresses" (user_id) WHERE is_default')
    // The migration dedupes existing rows first so the index can be created.
    expect(sql).toContain('b.updated_at, b.id) > (a.updated_at, a.id)')
    expect(source('lib/db/migrate-bundle.ts')).toContain('idx_user_addresses_one_default_per_user')
  })

  it('category/group deletes run in one transaction and check the affected row', () => {
    const categories = source('app/actions/categories.ts')
    expect(categories).toContain('db.transaction(async (tx) => {')
    expect(categories).toContain("if (deleted.length === 0) return { success: false, error: 'Категория не найдена' }")
    const groups = source('app/actions/groups.ts')
    expect(groups).toContain('db.transaction(async (tx) => {')
    expect(groups).toContain("if (deleted.length === 0) return { success: false as const, error: 'Группа не найдена' }")
  })

  it('createUser rolls the account back when the role update matches no row', () => {
    const src = source('app/actions/users.ts')
    expect(src).toContain('if (res.rowCount === 0) {')
    expect(src).toContain('No row matched (e.g. the sign-up stored a normalized email)')
  })

  it('promo release is atomic without a client (db.transaction)', () => {
    const src = source('lib/shop/promo-usage.ts')
    expect(src).toContain('db.transaction((tx) => releaseWith(tx, orderReference))')
    expect(src).toContain('async function releaseWith(')
  })

  it('storefront checkout enforces the active delivery/payment methods', () => {
    const src = source('app/actions/shop.ts')
    expect(src).toContain('getActiveDeliveryMethods')
    expect(src).toContain('getActivePaymentMethods')
    expect(src).toContain('activeDelivery.some((m) => m.code === input.deliveryMethod)')
    expect(src).toContain('activePayment.some((m) => m.code === input.paymentMethod)')
  })

  it('admin order creation rejects a variant from another product', () => {
    const src = source('app/actions/orders.ts')
    expect(src).toContain('variantProductId.get(item.variantId) !== item.productId')
    expect(src).toContain('Варіант не належить товару')
  })

  it('variant stock deduction is scoped to the variant of that product', () => {
    const src = source('lib/shop/order-fulfillment.ts')
    expect(src).toContain('WHERE id = $2 AND product_id = $3 AND quantity >= $1 RETURNING quantity')
  })

  it('password change revokes other sessions and keeps the current one', () => {
    const src = source('app/actions/shop-auth.ts')
    expect(count(src, 'DELETE FROM session WHERE "userId" = $1 AND id <> $2')).toBe(1)
    expect(src).toContain('auth.api.getSession({ headers: await headers() })')
  })
})
