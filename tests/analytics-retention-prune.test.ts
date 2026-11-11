import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const source = (file: string) => readFileSync(resolve(root, file), 'utf8')
const count = (text: string, needle: string) => text.split(needle).length - 1

describe('analytics-retention pruning (LOW)', () => {
  it('prunes terminal outbox rows and stale geo_cache rows', () => {
    const src = source('app/api/cron/analytics-retention/route.ts')
    // Retention windows: sent 30d, dead 90d (longer — debugging trail),
    // geo_cache 90d.
    expect(src).toContain('OUTBOX_SENT_RETENTION_DAYS = 30')
    expect(src).toContain('OUTBOX_DEAD_RETENTION_DAYS = 90')
    expect(src).toContain('GEO_CACHE_RETENTION_DAYS = 90')
    // One bounded DELETE per status, same style as the analytics_events
    // prune (no LIMIT — the daily run keeps each batch small).
    expect(count(src, 'DELETE FROM notification_outbox')).toBe(2)
    expect(src).toContain("WHERE status = 'sent'")
    expect(src).toContain("WHERE status = 'dead'")
    // updated_at marks the end of an outbox row's life (bumped on every
    // status change); geo_cache rows carry resolved_at.
    expect(src).toContain('updated_at < NOW()')
    expect(src).toContain('DELETE FROM geo_cache')
    expect(src).toContain('resolved_at < NOW()')
    // Only terminal rows are pruned — pending/sending rows must survive.
    expect(src).not.toContain("status = 'pending'")
    expect(src).not.toContain("status = 'sending'")
  })

  it('does not touch the outbox worker claim/retry/dead logic', () => {
    const src = source('lib/notifications.ts')
    expect(src).toContain('MAX_OUTBOX_ATTEMPTS = 5')
    expect(src).toContain("SET status = 'sending'")
    expect(src).toContain("SET status = 'sent'")
    expect(src).toContain("SET status = 'dead'")
  })
})

describe('cron scheduler wait (LOW)', () => {
  it('waits out the route ceiling instead of cutting jobs off at 55s', () => {
    const src = source('lib/cron/scheduler.ts')
    expect(src).toContain('JOB_FETCH_TIMEOUT_MS = 280_000')
    expect(src).toContain('setTimeout(() => ctrl.abort(), JOB_FETCH_TIMEOUT_MS)')
    expect(src).not.toContain('55_000')
  })
})
