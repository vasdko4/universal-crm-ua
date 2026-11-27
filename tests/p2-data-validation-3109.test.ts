import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { describe, expect, it } from 'vitest'

// 3.4.109 Worker B (P2 data validation): structural tests for #12, #13,
// #14, ITEM 0 and #44. The actions under test need a DB/session, so these
// assert the validation code is present in the right functions (same
// convention as shop-email-change-reauth.test.ts / order-delivery-ttn.test.ts).

const root = resolve(import.meta.dirname, '..')
const source = (file: string) => readFileSync(resolve(root, file), 'utf8').replace(/\r\n/g, '\n')

/** Source slice of one `export async function <name>(` in `src`. */
function fnSection(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}(`)
  expect(start).toBeGreaterThan(-1)
  const next = src.indexOf('export async function ', start + 10)
  return next === -1 ? src.slice(start) : src.slice(start, next)
}

describe('#12 promotions enums + target validation', () => {
  const src = source('app/actions/promotions.ts')

  it('validate() allowlists type / discountType / targetType', () => {
    expect(src).toContain('PROMOTION_TYPES')
    expect(src).toContain("'promocode', 'discount'")
    expect(src).toContain("'percentage', 'fixed'")
    expect(src).toContain("'all', 'groups', 'products'")
    expect(src).toContain('Невідомий тип акції')
    expect(src).toContain('Невідомий тип знижки')
    expect(src).toContain('Невідомий тип цільової аудиторії')
  })

  it('target ids are integers >= 1, at most 200 each', () => {
    expect(src).toContain('MAX_TARGET_IDS = 200')
    expect(src).toContain('validateTargetIds')
    expect(src).toContain('Number.isInteger(id) || id < 1')
  })

  it('validateTargets() checks referenced ids exist', () => {
    expect(src).toContain('async function validateTargets')
    expect(src).toContain('Обрано неіснуючу групу товарів')
    expect(src).toContain('Обрано неіснуючий товар')
  })

  it('both create and update call validate() and validateTargets()', () => {
    for (const name of ['createPromotion', 'updatePromotion']) {
      const fn = fnSection(src, name)
      expect(fn).toContain('validate(input)')
      expect(fn).toContain('await validateTargets(input)')
    }
  })
})

describe('#13 orders validation', () => {
  const src = source('app/actions/orders.ts')

  it('createOrder validates delivery/payment methods against the checkout enums', () => {
    const fn = fnSection(src, 'createOrder')
    expect(fn).toContain('CHECKOUT_DELIVERY_METHODS')
    expect(fn).toContain('CHECKOUT_PAYMENT_METHODS')
    expect(fn).toContain('Невідомий спосіб доставки')
    expect(fn).toContain('Невідомий спосіб оплати')
  })

  it('createOrder caps items (<= 100), qty (1–999) and money, and checks customerId', () => {
    const fn = fnSection(src, 'createOrder')
    expect(fn).toContain('input.items.length > 100')
    expect(fn).toContain('item.quantity > 999')
    expect(fn).toContain('MONEY_12_2_MAX')
    expect(fn).toContain('Клієнт не знайдений')
    expect(fn).toContain('Імʼя клієнта занадто довге')
    expect(fn).toContain('Некоректна вартість доставки')
  })

  it('listOrders allowlists status / paymentStatus / deliveryMethod filters and validates dates', () => {
    const fn = fnSection(src, 'listOrders')
    expect(fn).toContain('ORDER_STATUSES.some')
    expect(fn).toContain('PAYMENT_STATUSES.some')
    expect(fn).toContain('CHECKOUT_DELIVERY_METHODS')
    expect(fn).toContain('new Date(params.from)')
    expect(fn).toContain('new Date(params.to)')
  })

  it('updateOrderDelivery / Note / Tags are capped', () => {
    expect(fnSection(src, 'updateOrderDelivery')).toContain('Невідомий спосіб доставки')
    expect(fnSection(src, 'updateOrderDelivery')).toContain('Номер накладної занадто довгий')
    expect(fnSection(src, 'updateOrderNote')).toContain('Примітка занадто довга')
    expect(fnSection(src, 'updateOrderTags')).toContain('Некоректні теги замовлення')
  })

  it('status transitions are enforced (already in base, verified here)', () => {
    expect(fnSection(src, 'updateOrderStatus')).toContain('isOrderStatusTransitionAllowed')
    expect(fnSection(src, 'updateOrderPayment')).toContain('isPaymentStatusTransitionAllowed')
    // bulk delegates per-item to updateOrderStatus, so transitions apply there too.
    expect(fnSection(src, 'bulkUpdateOrderStatus')).toContain('await updateOrderStatus(id, status)')
  })

  it('refundOrder is rate-limited per admin (refundPayment has no limit of its own)', () => {
    const fn = fnSection(src, 'refundOrder')
    expect(fn).toContain("isRateLimited('order-refund'")
    expect(fn).toContain('Некорректний id замовлення')
  })
})

describe('#14 customers reliabilityScore', () => {
  const src = source('app/actions/customers.ts')

  it('validate() requires integer 0–100 when present, with typeof guards and column caps', () => {
    expect(src).toContain('Оцінка надійності має бути цілим числом від 0 до 100')
    expect(src).toContain('Number.isInteger(input.reliabilityScore)')
    expect(src).toContain('reliabilityScore < 0')
    expect(src).toContain('reliabilityScore > 100')
    expect(src).toContain('Імʼя занадто довге')
    expect(src).toContain('Телефон занадто довгий')
  })

  it('updateCustomer proves existence with .returning() before deleting contacts', () => {
    const fn = fnSection(src, 'updateCustomer')
    expect(fn).toContain('.returning({ id: customers.id })')
    const returningAt = fn.indexOf('.returning({ id: customers.id })')
    const deleteAt = fn.indexOf('await tx.delete(customerContacts)')
    expect(returningAt).toBeGreaterThan(-1)
    expect(deleteAt).toBeGreaterThan(returningAt)
    expect(fn).toContain("Клиент не найден")
  })
})

describe('ITEM 0 profile name', () => {
  const src = source('app/actions/shop-auth.ts')

  it('updateCustomerProfile typeof-checks name and caps it at 120 chars', () => {
    const fn = fnSection(src, 'updateCustomerProfile')
    expect(fn).toContain("typeof input?.name !== 'string'")
    expect(fn).toContain('trim().slice(0, 120)')
  })

  it('the write stays parameterised (no SQLi)', () => {
    const fn = fnSection(src, 'updateCustomerProfile')
    expect(fn).toContain('UPDATE "user" SET name=$1')
  })
})

describe('ITEM 0 render check: user.name is only ever escaped React text', () => {
  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry)
      if (statSync(p).isDirectory()) {
        if (entry === 'node_modules') continue
        walk(p, out)
      } else if (/\.(tsx?|ts)$/.test(entry)) {
        out.push(p)
      }
    }
    return out
  }

  it('no dangerouslySetInnerHTML site renders the shopper name', () => {
    const rawFiles = walk(resolve(root, 'app'))
      .concat(walk(resolve(root, 'components')))
      .concat(walk(resolve(root, 'lib')))
      .filter((f) => readFileSync(f, 'utf8').includes('dangerouslySetInnerHTML'))
    expect(rawFiles.length).toBeGreaterThan(0)
    for (const f of rawFiles) {
      const text = readFileSync(f, 'utf8')
      expect(text).not.toContain('user.name')
      expect(text).not.toContain('shopUser.name')
    }
  })

  it('account pages render user.name as plain JSX text (React-escaped)', () => {
    // page.tsx renders the name directly; layout.tsx renders it through
    // initials() into JSX text — both are React-escaped, never raw HTML.
    const page = source('app/(shop)/account/(protected)/page.tsx')
    expect(page).toContain('{user.name}')
    expect(page).not.toContain('dangerouslySetInnerHTML')
    const layout = source('app/(shop)/account/(protected)/layout.tsx')
    expect(layout).toContain('initials(user.name')
    expect(layout).not.toContain('dangerouslySetInnerHTML')
  })

  it('JSON-LD (the one raw site embedding customer text) escapes "<"', () => {
    const text = source('components/shop/json-ld.tsx')
    expect(text).toContain('JSON.stringify(data)')
    expect(text).toContain('u003c')
  })
})

describe('#44 verified-email check — wired into the four flows ONLY', () => {
  const src = source('app/actions/shop-auth.ts')

  it('the helper returns the error only when verified === false (null passes through)', () => {
    expect(src).toContain('async function requireVerifiedCurrentEmail')
    expect(src).toContain('rows[0]?.emailVerified === false')
    expect(src).toContain("Спочатку підтвердіть свій поточний email.")
  })

  it('each of the four flows calls the helper', () => {
    for (const name of [
      'requestEmailChange',
      'confirmEmailChange',
      'requestPasswordChange',
      'confirmPasswordChange',
    ]) {
      expect(fnSection(src, name)).toContain('await requireVerifiedCurrentEmail(user.id)')
    }
  })

  it('no other flow in shop-auth.ts calls it (checkout/sign-in are not gated)', () => {
    const calls = src.match(/await requireVerifiedCurrentEmail\(user\.id\)/g) ?? []
    expect(calls).toHaveLength(4)
    for (const name of [
      'checkPhoneAvailable',
      'finalizeCustomerRole',
      'sendEmailVerification',
      'confirmEmailVerification',
      'saveCustomerPhone',
      'updateCustomerProfile',
      'getEmailChangeAvailability',
      'requestOldEmailChangeCode',
      'getProfileSecurity',
    ]) {
      expect(fnSection(src, name)).not.toContain('requireVerifiedCurrentEmail')
    }
  })

  it('confirmPasswordChange caps the password at 128 and typeof-guards its inputs', () => {
    const fn = fnSection(src, 'confirmPasswordChange')
    expect(fn).toContain('password.length > 128')
    expect(fn).toContain("typeof codeRaw !== 'string' || typeof newPasswordRaw !== 'string'")
  })

  it('confirmEmailChange typeof-guards its code', () => {
    expect(fnSection(src, 'confirmEmailChange')).toContain("typeof codeRaw !== 'string'")
  })
})
