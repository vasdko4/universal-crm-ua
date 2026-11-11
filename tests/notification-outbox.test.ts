import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { nextAttemptDelayMs, STALE_OUTBOX_CLAIM_MINUTES } from '../lib/notifications'
import { CRON_JOBS } from '../lib/cron/registry'

const root = join(__dirname, '..')
// Structural tests compare source text with LF literals; on Windows the
// checkout has CRLF line endings, so normalize here (Windows-only
// failures 11.11.2026: notification-outbox.test.ts:91).
const read = (rel: string) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n')

describe('notification outbox (audit item 33)', () => {
  it('backs off exponentially: 2/4/8/16 min, capped at 6h', () => {
    expect(nextAttemptDelayMs(1)).toBe(2 * 60_000)
    expect(nextAttemptDelayMs(2)).toBe(4 * 60_000)
    expect(nextAttemptDelayMs(3)).toBe(8 * 60_000)
    expect(nextAttemptDelayMs(4)).toBe(16 * 60_000)
    expect(nextAttemptDelayMs(5)).toBe(32 * 60_000)
    expect(nextAttemptDelayMs(10)).toBe(360 * 60_000)
    expect(nextAttemptDelayMs(100)).toBe(360 * 60_000)
  })

  it('migration creates notification_outbox with dedup index', () => {
    const sql = read('db/migrate.sql')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS notification_outbox')
    expect(sql).toContain("status TEXT NOT NULL DEFAULT 'pending'")
    expect(sql).toContain('notification_outbox_due_idx')
    // A failed channel is queued at most once per order while pending.
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS notification_outbox_pending_unique_idx')
    expect(sql).toContain("WHERE status = 'pending'")
  })

  it('retry job is registered every 15 minutes', () => {
    const job = CRON_JOBS.find((j) => j.id === 'notification-retry')
    expect(job).toBeDefined()
    expect(job!.intervalMs).toBe(15 * 60_000)
    expect(job!.nameKey).toBe('notificationRetryName')
    expect(job!.descKey).toBe('notificationRetryDesc')
  })

  it('vercel cron calls the retry route every 15 minutes', () => {
    const vercel = JSON.parse(read('vercel.json'))
    const entry = vercel.crons.find((c: { path: string }) => c.path === '/api/cron/notification-retry')
    expect(entry).toBeDefined()
    expect(entry.schedule).toBe('*/15 * * * *')
  })

  it('retry route exists and follows the cron auth + kill-switch pattern', () => {
    expect(existsSync(join(root, 'app/api/cron/notification-retry/route.ts'))).toBe(true)
    const route = read('app/api/cron/notification-retry/route.ts')
    expect(route).toContain('authorizeCronRequest')
    expect(route).toContain("isCronJobEnabled('notification-retry')")
    expect(route).toContain('processNotificationOutbox')
    expect(route).toContain("recordCronRun('notification-retry'")
  })

  it('notifications module exposes the outbox worker and enqueues failures', () => {
    const src = read('lib/notifications.ts')
    expect(src).toContain('export async function processNotificationOutbox')
    expect(src).toContain('export function nextAttemptDelayMs')
    expect(src).toContain('ON CONFLICT (kind, channel, order_id) WHERE status = \'pending\' DO NOTHING')
    // Atomic claim so two workers never send the same row twice.
    expect(src).toContain("SET status = 'sending'")
    expect(src).toContain("AND status = 'pending' RETURNING id")
    // Dead after 5 attempts.
    expect(src).toContain("status = 'dead'")
    // sendMail's { sent, fallback } is honored: only sent counts — a
    // fallback (SMTP not configured) is a failure and gets enqueued (A10).
    expect(src).toContain('return r.sent')
    expect(src).not.toContain('r.sent || r.fallback')
  })

  it('i18n keys exist in both admin dictionaries', () => {
    const dict = read('lib/i18n/admin/dictionaries.ts')
    expect(dict).toContain('notificationRetryName')
    expect(dict).toContain('notificationRetryDesc')
    expect(dict).toContain("notificationRetryName: 'Повтор сповіщень'")
    expect(dict).toContain("notificationRetryName: 'Повтор уведомлений'")
  })
})

describe('notification outbox: stale-claim reaper (second code review)', () => {
  it('reclaims sending claims older than 10 minutes, attempts preserved', () => {
    // 10x the notification-retry route's 60s maxDuration, inside the
    // 15-minute retry cadence.
    expect(STALE_OUTBOX_CLAIM_MINUTES).toBe(10)
    const src = read('lib/notifications.ts')
    const start = src.indexOf('async function reapStaleOutboxClaims')
    expect(start).toBeGreaterThan(-1)
    const reaper = src.slice(start, src.indexOf('\n}\n', start))
    expect(reaper).toContain("SET status = 'pending'")
    expect(reaper).toContain("o.status = 'sending'")
    expect(reaper).toContain("($1 || ' minutes')::interval")
    // Attempts are preserved — the send may never have happened.
    expect(reaper).not.toContain('attempts')
    // The pending-only unique index must survive the reset: a second enqueue
    // can land while a row is 'sending'.
    expect(reaper).toContain('NOT EXISTS')
    // Reclaimed rows are reported, and a reaper failure never breaks the run.
    expect(reaper).toContain("reportError('notify.outbox-reaped'")
    expect(reaper).toContain("reportError('notify.outbox-reaper'")
    // The reaper runs before the worker claims rows.
    const workerIdx = src.indexOf('export async function processNotificationOutbox')
    expect(src.indexOf('await reapStaleOutboxClaims()', workerIdx)).toBeGreaterThan(workerIdx)
  })

  it('delivery-status emails go through the outbox', () => {
    const src = read('lib/notifications.ts')
    expect(src).toContain("'delivery-status'")
    expect(src).toContain('async function sendDeliveryStatusEmail')
    expect(src).toContain("if (kind === 'delivery-status') return sendDeliveryStatusEmail(ctx, { messageId })")
    expect(src).toContain('export async function enqueueNotification')
    const sync = read('lib/delivery/sync-tracking.ts')
    // A11: the outbox INSERT is inline in sync-tracking.ts (same row shape
    // as enqueueNotification) so it shares the status transaction — the
    // helper call is gone, the email still goes through the outbox.
    expect(sync).toContain('INSERT INTO notification_outbox (kind, channel, order_id, status)')
    expect(sync).toContain("VALUES ('delivery-status', 'customer-email', $1, 'pending')")
    expect(sync).not.toContain('sendMail')
    expect(sync).not.toContain('buildOrderMessage')
    expect(sync).toContain('settings?.emailSettings?.enabled')
  })

  it('master email toggle stops customer order emails', () => {
    const src = read('lib/notifications.ts')
    // Shipped emails respect the master toggle.
    const shippedStart = src.indexOf('async function sendShippedOrderEmail')
    const shipped = src.slice(shippedStart, src.indexOf('\n}\n', shippedStart))
    expect(shipped).toContain('if (!settings.emailSettings?.enabled) return true')
    // Confirmation: master toggle first; a blocked requisites email pages
    // the admin instead of being silently dropped.
    const confirmStart = src.indexOf('async function sendNewOrderCustomerEmail')
    const confirm = src.slice(confirmStart, src.indexOf('\n}\n', confirmStart))
    expect(confirm).toContain('if (!settings.emailSettings?.enabled) {')
    expect(confirm).toContain("'notify.customer-email-disabled'")
    expect(confirm).toContain('alertAdmin: true')
    // Requisites orders still bypass the confirmation-only toggle.
    expect(confirm).toContain('if (!(n.customerEmailEnabled || isRequisites)) return true')
  })
})
