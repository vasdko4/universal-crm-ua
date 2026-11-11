import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')
// Structural tests compare source text with LF literals; on Windows the
// checkout has CRLF line endings, so normalize here.
const source = (file: string) => readFileSync(resolve(root, file), 'utf8').replace(/\r\n/g, '\n')

// Audit A9/A10/A14 fixes (3.4.94).
describe('notification A9: catch path enqueues before reporting', () => {
  it('notifyNewOrder catch enqueues all three channels', () => {
    const src = source('lib/notifications.ts')
    const start = src.indexOf('export async function notifyNewOrder')
    expect(start).toBeGreaterThan(-1)
    const fn = src.slice(start, src.indexOf('\n}\n', start))
    // All three channels are enqueued in the catch, before reportError.
    expect(fn).toContain("enqueueNotification('new-order', 'customer-email', orderId)")
    expect(fn).toContain("enqueueNotification('new-order', 'admin-email', orderId)")
    expect(fn).toContain("enqueueNotification('new-order', 'telegram', orderId)")
    expect(fn).toContain("void reportError('notify.new-order', e)")
    expect(fn.indexOf("enqueueNotification('new-order', 'customer-email', orderId)")).toBeLessThan(
      fn.indexOf("void reportError('notify.new-order', e)"),
    )
  })

  it('notifyShippedOrder catch enqueues the shipped channel', () => {
    const src = source('lib/notifications.ts')
    const start = src.indexOf('export async function notifyShippedOrder')
    expect(start).toBeGreaterThan(-1)
    const fn = src.slice(start, src.indexOf('\n}\n', start))
    expect(fn).toContain("enqueueNotification('shipped', 'customer-email', orderId)")
    expect(fn).toContain("void reportError('notify.shipped-order', e)")
  })
})

describe('notification A10: unconfigured SMTP is a failure, not a success', () => {
  it('the four order-email senders return r.sent, never r.sent || r.fallback', () => {
    const src = source('lib/notifications.ts')
    expect(src).not.toContain('r.sent || r.fallback')
    // Each of the four senders still returns r.sent.
    expect(src.match(/return r\.sent$/gm)?.length).toBe(4)
  })

  it('the mailer still reports fallback (the senders, not the transport, decide)', () => {
    const mailer = source('lib/mailer.ts')
    expect(mailer).toContain('return { sent: false, fallback: true }')
  })
})

describe('notification A14: stable Message-ID for outbox retries', () => {
  it('sendMail accepts an optional messageId and uses it as the Message-ID', () => {
    const mailer = source('lib/mailer.ts')
    expect(mailer).toContain('messageId?: string')
    expect(mailer).toContain('payload.messageId ??')
  })

  it('sendOutboxRow derives the stable id from the outbox row and passes it on', () => {
    const src = source('lib/notifications.ts')
    const start = src.indexOf('async function sendOutboxRow')
    expect(start).toBeGreaterThan(-1)
    const fn = src.slice(start, src.indexOf('\n}\n', start))
    expect(fn).toContain('outboxId?: number')
    expect(fn).toContain('`outbox-${outboxId}`')
    expect(fn).toContain('sendShippedOrderEmail(ctx, { messageId })')
    expect(fn).toContain('sendDeliveryStatusEmail(ctx, { messageId })')
    expect(fn).toContain('sendNewOrderCustomerEmail(ctx, { messageId })')
    expect(fn).toContain('sendNewOrderAdminEmail(ctx, { messageId })')
    // The worker passes the claimed row id.
    expect(src).toContain('row.id,')
    const worker = src.slice(src.indexOf('export async function processNotificationOutbox'))
    expect(worker).toContain('sendOutboxRow(')
    expect(worker).toContain('row.id')
  })
})
