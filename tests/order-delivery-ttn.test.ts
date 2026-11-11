import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')
// Structural tests compare source text with LF literals; normalize so the
// file also passes on a Windows CRLF checkout.
const source = (file: string) => readFileSync(resolve(root, file), 'utf8').replace(/\r\n/g, '\n')

// Audit 3.4.95 (order management): updateOrderDelivery must normalize the
// TTN (trim, empty -> NULL) and map a duplicate-TTN 23505 to a localized
// conflict result instead of an unhandled server-action exception; the dead
// deliveryCost input is removed from the action.
describe('updateOrderDelivery — duplicate TTN handling', () => {
  const src = source('app/actions/orders.ts')
  const fnStart = src.indexOf('export async function updateOrderDelivery(')
  const fnEnd = src.indexOf('export async function updateOrderNote(', fnStart)
  const fn = src.slice(fnStart, fnEnd)

  it('normalizes the TTN: trim, empty/blank -> NULL (migration invariant)', () => {
    expect(fnStart).toBeGreaterThan(-1)
    // The raw value must never reach the unique index.
    expect(fn).not.toContain('set.trackingNumber = data.trackingNumber')
    expect(fn).toContain('data.trackingNumber.trim()')
    expect(fn).toContain('|| null')
    // Clearing the TTN writes NULL, so two cleared orders never conflict.
    expect(fn).toMatch(/set\.trackingNumber = ttn/)
    // The history entry records the trimmed TTN, not the raw input.
    expect(fn).toContain('number: ttn,')
    expect(fn).not.toContain('number: data.trackingNumber,')
  })

  it('duplicate TTN returns a localized error instead of throwing', () => {
    expect(fn).toContain('isUniqueViolation')
    expect(fn).toContain("await db.update(orders).set(set).where(eq(orders.id, id))")
    // The update is wrapped: unique violation -> conflict result.
    const tryAt = fn.indexOf('try {')
    const updateAt = fn.indexOf('await db.update(orders)', tryAt)
    const catchAt = fn.indexOf('} catch (e) {', updateAt)
    const returnAt = fn.indexOf('return { success: false, error:', catchAt)
    expect(tryAt).toBeGreaterThan(-1)
    expect(updateAt).toBeGreaterThan(tryAt)
    expect(catchAt).toBeGreaterThan(updateAt)
    expect(returnAt).toBeGreaterThan(catchAt)
    expect(fn.slice(catchAt, returnAt + 120)).toContain('isUniqueViolation(e)')
    expect(fn.slice(returnAt, returnAt + 120)).toContain('ttnAlreadyLinked')
    // Non-unique errors still escape (existing behaviour for real failures).
    expect(fn.slice(catchAt, fnEnd)).toContain('throw e')
  })

  it('no SELECT pre-check: the unique index is the final arbiter (race-safe)', () => {
    // A pre-check would race with a concurrent bind; the 23505 catch is
    // the only correct guard, exactly like ttn.ts documents.
    expect(fn).not.toContain('SELECT id FROM orders WHERE tracking_number')
    expect(fn).not.toContain('tracking_number = $1 AND id <> $2')
  })

  it('localized conflict message exists in uk and ru (same wording family as ttn.ts)', () => {
    const dict = source('lib/i18n/admin/dictionaries.ts')
    expect(dict).toContain('ttnAlreadyLinked: string')
    expect(dict).toContain('ТТН вже прив’язана до іншого замовлення — спробуйте ще раз')
    expect(dict).toContain('ТТН уже привязана к другому заказу — попробуйте ещё раз')
  })
})

describe('updateOrderDelivery — dead deliveryCost input removed', () => {
  it('the input type no longer accepts deliveryCost', () => {
    const src = source('app/actions/orders.ts')
    const fnStart = src.indexOf('export async function updateOrderDelivery(')
    const fnEnd = src.indexOf('export async function updateOrderNote(', fnStart)
    const fn = src.slice(fnStart, fnEnd)
    expect(fn).not.toContain('deliveryCost')
  })

  it('no caller passes deliveryCost', () => {
    for (const file of ['app/actions/ttn.ts', 'components/orders/order-detail.tsx']) {
      const src = source(file)
      let at = 0
      while ((at = src.indexOf('updateOrderDelivery(', at)) !== -1) {
        // The call's argument object ends within a few hundred chars.
        expect(src.slice(at, at + 400)).not.toContain('deliveryCost')
        at += 1
      }
    }
  })

  it('order creation still writes deliveryCost (only writer, untouched)', () => {
    const src = source('app/actions/orders.ts')
    expect(src).toContain('deliveryCost: deliveryCost.toFixed(2),')
  })
})
