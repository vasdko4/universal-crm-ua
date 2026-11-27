import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const source = (file: string) => readFileSync(resolve(root, file), 'utf8')

import {
  buildOrderMessage,
  isValidOrderMessageChannel,
  isValidOrderMessageKind,
} from '@/lib/order-messages'

const order = {
  id: 42,
  orderNumber: 'PF-123456789012',
  customerName: 'Іван Петренко',
  customerPhone: '+380991234567',
  customerEmail: 'ivan@example.com',
  deliveryMethod: 'nova_poshta',
  deliveryCity: 'Київ',
  deliveryBranch: 'Відділення 5',
  deliveryAddress: null,
  deliveryStatus: null,
  trackingNumber: null,
  paymentMethod: 'cod',
  paymentStatus: 'unpaid',
  itemsTotal: '1000',
  deliveryCost: '0',
  total: '1000',
  currency: 'UAH',
  status: 'new',
  note: null,
} as never

const items = [
  {
    id: 1,
    productId: 7,
    name: 'Кросівки',
    variantLabel: null,
    sku: 'SN-1',
    image: null,
    price: '1000',
    quantity: 1,
    total: '1000',
  },
] as never

// Audit #8 (3.4.109): prom-sync was the only cron route without the
// kill-switch + single-flight lock.
describe('prom-sync cron guards (audit #8)', () => {
  it('all 7 cron routes have auth -> kill-switch -> lock ordering', () => {
    for (const id of [
      'analytics-retention',
      'anomaly-alert',
      'db-backup',
      'delivery-sync',
      'expire-pending',
      'notification-retry',
      'prom-sync',
    ]) {
      const src = source(`app/api/cron/${id}/route.ts`)
      const authAt = src.indexOf('authorizeCronRequest')
      const killAt = src.indexOf(`isCronJobEnabled('${id}')`)
      const lockAt = src.indexOf(`withCronLock('${id}'`)
      expect(authAt, id).toBeGreaterThan(-1)
      expect(killAt, id).toBeGreaterThan(authAt)
      expect(lockAt, id).toBeGreaterThan(killAt)
      expect(src).toContain("error: 'cron job already running'")
      expect(src).toContain('{ status: 409 }')
    }
  })

  it('the route lock and the inner sync lock use different advisory keys', () => {
    // withCronLock locks `cron-run:<job>`; syncPromProducts locks `prom-sync`.
    expect(source('lib/cron/with-cron-lock.ts')).toContain('`cron-run:${jobId}`')
    expect(source('lib/prom/sync.ts')).toContain("const PROM_SYNC_LOCK_KEY = 'prom-sync'")
    expect(source('app/api/cron/prom-sync/route.ts')).toContain('syncPromProducts()')
  })
})

// Audit #9 (3.4.109): media proxy was 2400/min — same 60/min as email-image.
describe('media proxy limit (audit #9)', () => {
  it('proxies at 60/min, not 2400/min', () => {
    const src = source('app/api/media/route.ts')
    expect(src).toContain("proxyImageResponse(req, 'media-image', 60)")
    expect(src).not.toContain('2400')
    expect(source('app/api/email-image/route.ts')).toContain(
      "proxyImageResponse(req, 'email-image', 60)",
    )
  })
})

// Audit #10 (3.4.109): kind/channel allowlists + throw + mailto escaping.
describe('order message validation (audit #10)', () => {
  it('accepts the four kinds and five channels, rejects the rest', () => {
    for (const kind of ['confirmation', 'shipped', 'status', 'instruction']) {
      expect(isValidOrderMessageKind(kind)).toBe(true)
    }
    for (const channel of ['email', 'viber', 'telegram', 'whatsapp', 'sms']) {
      expect(isValidOrderMessageChannel(channel)).toBe(true)
    }
    expect(isValidOrderMessageKind('bogus')).toBe(false)
    expect(isValidOrderMessageKind(undefined)).toBe(false)
    expect(isValidOrderMessageChannel('pigeon')).toBe(false)
    expect(isValidOrderMessageChannel(undefined)).toBe(false)
  })

  it('buildOrderMessage throws on an unknown kind instead of rendering the status fallback', () => {
    expect(() => buildOrderMessage('bogus' as never, order, items, {})).toThrow(
      /Unknown order message kind/,
    )
    expect(buildOrderMessage('confirmation', order, items, {}).subject).toContain(
      'PF-123456789012',
    )
  })

  it('escapes the support email inside the mailto href', () => {
    const { html } = buildOrderMessage('confirmation', order, items, {
      supportEmail: 'a@b.com" onclick="alert(1)',
    })
    expect(html).toContain('mailto:a@b.com&quot;')
    expect(html).not.toContain('mailto:a@b.com" onclick=')
  })
})

// Audit #15 (3.4.109): no caller-supplied token/chatId, stored settings only,
// format-checked, 3/min per admin.
describe('sendTestTelegram (audit #15)', () => {
  const src = source('app/actions/notifications.ts')

  it('takes no arguments — stored settings only', () => {
    expect(src).toContain('export async function sendTestTelegram()')
    expect(src).not.toContain('input?:')
    expect(src).not.toContain('botToken?.')
    expect(src).toContain('settings.notifications.telegramBotToken')
    expect(src).toContain('settings.notifications.telegramChatId')
  })

  it('format-checks the stored token and chat id before any outbound call', () => {
    expect(src).toContain('/^\\d+:[A-Za-z0-9_-]{30,}$/')
    expect(src).toContain('/^-?\\d+$/')
  })

  it('is capped at 3/min per admin', () => {
    expect(src).toContain("isRateLimited('telegram-test', me.id, 3, 60_000)")
  })

  it('the sole caller passes no args', () => {
    expect(source('components/settings/notifications-tab.tsx')).toContain(
      'await sendTestTelegram()',
    )
    expect(source('components/settings/notifications-tab.tsx')).not.toContain(
      'sendTestTelegram({',
    )
  })
})

// Audit #16 (3.4.109): the three missing paid/external-action limits, plus
// the refund gate (refundPayment had NO limit in the 3.4.108 base — the
// audit's "existing isRateLimited" did not exist; refundOrder delegates
// here, so one gate covers both entry points).
describe('paid/external admin action limits (audit #16)', () => {
  it('createTtnForOrder 10/min, printTtnForOrder 30/min per admin', () => {
    const src = source('app/actions/ttn.ts')
    expect(src).toContain("isRateLimited('ttn-create', user.id, 10, 60_000)")
    expect(src).toContain("isRateLimited('ttn-print', user.id, 30, 60_000)")
  })

  it('triggerPromSync 10/min per admin', () => {
    expect(source('app/actions/prom.ts')).toContain(
      "isRateLimited('prom-sync-manual', user.id, 10, 60_000)",
    )
  })

  it('startPromImport 5/hour per admin', () => {
    expect(source('app/actions/prom-import.ts')).toContain(
      "isRateLimited('prom-import-start', me.id, 5, 3_600_000)",
    )
  })

  it('refundPayment is limited 10/min per admin and refundOrder delegates to it', () => {
    expect(source('app/actions/payments.ts')).toContain(
      "isRateLimited('refund-payment', me.id, 10, 60_000)",
    )
    expect(source('app/actions/orders.ts')).toContain('refundPayment(payment.id, amount)')
  })

  it('previously-limited routes are still limited', () => {
    expect(source('app/api/v1/delivery/nova-poshta/cities/route.ts')).toContain(
      "isRateLimited('v1-np-cities'",
    )
    expect(source('app/api/v1/delivery/nova-poshta/warehouses/route.ts')).toContain(
      "isRateLimited('v1-np-warehouses'",
    )
  })
})

// Audit #17 (3.4.109): order lookups already return one identical 404 for
// every failure mode — lock that contract in.
describe('order lookup oracle contract (audit #17)', () => {
  it('POST + GET lookups answer the same 404 for unknown number, bad phone and mismatch', () => {
    for (const file of [
      'app/api/v1/orders/lookup/route.ts',
      'app/api/v1/orders/[number]/route.ts',
      'app/api/v1/orders/[number]/payment/route.ts',
    ]) {
      const src = source(file)
      expect(src).toContain("NOT_FOUND = 'Замовлення не знайдено'")
      expect(src).toContain('fail(NOT_FOUND, 404)')
    }
    expect(source('lib/api/order-lookup.ts')).toContain(
      'Every failure mode — missing/invalid phone, unknown number,',
    )
  })
})
