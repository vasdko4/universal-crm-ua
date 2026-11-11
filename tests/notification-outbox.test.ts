import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { nextAttemptDelayMs } from '../lib/notifications'
import { CRON_JOBS } from '../lib/cron/registry'

const root = join(__dirname, '..')
const read = (rel: string) => readFileSync(join(root, rel), 'utf8')

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
    // sendMail's { sent, fallback } is honored: a false return is a failure.
    expect(src).toContain('r.sent || r.fallback')
  })

  it('i18n keys exist in both admin dictionaries', () => {
    const dict = read('lib/i18n/admin/dictionaries.ts')
    expect(dict).toContain('notificationRetryName')
    expect(dict).toContain('notificationRetryDesc')
    expect(dict).toContain("notificationRetryName: 'Повтор сповіщень'")
    expect(dict).toContain("notificationRetryName: 'Повтор уведомлений'")
  })
})
