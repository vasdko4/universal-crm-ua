import { NextResponse, type NextRequest } from 'next/server'
import { pool } from '@/lib/db'
import { authorizeCronRequest } from '@/lib/cron-auth'
import { isCronJobEnabled, recordCronRun } from '@/lib/cron/store'
import { reportError } from '@/lib/server-errors'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const RETENTION_DAYS = 90

/** Delivered notifications are audit trail, not live data — a month is enough. */
const OUTBOX_SENT_RETENTION_DAYS = 30
/** Dead rows are worth keeping longer: they are the debugging trail for failed sends. */
const OUTBOX_DEAD_RETENTION_DAYS = 90
/**
 * geo_cache is keyed by IP hash and would otherwise grow by every distinct
 * visitor IP forever (there is no TTL on the rows). Region/city for an old
 * IP is stale anyway and cheap to re-resolve, so 90 days bounds the table
 * to ~3 months of distinct visitors.
 */
const GEO_CACHE_RETENTION_DAYS = 90

/**
 * Drops storefront analytics_events older than 90 days so `/api/track`
 * cannot grow the table without bound (FIX-32). Also prunes the
 * notification_outbox terminal rows (sent/dead — the retry worker never
 * reads them again) and stale geo_cache rows, so neither table grows
 * without bound either.
 */
export async function GET(req: NextRequest) {
  const auth = authorizeCronRequest(process.env.CRON_SECRET, req.headers.get('authorization'))
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  // Admin Cron tab kill-switch: disabled jobs refuse to run (fail closed).
  if (!(await isCronJobEnabled('analytics-retention'))) {
    return NextResponse.json({ ok: false, error: 'cron job disabled' }, { status: 503 })
  }

  try {
    const result = await pool.query(
      `DELETE FROM analytics_events
       WHERE created_at < NOW() - ($1::text || ' days')::interval
         AND type IN ('pageview', 'product_view', 'add_to_cart')`,
      [String(RETENTION_DAYS)],
    )
    // Terminal outbox rows: 'sent'/'dead' are never read by the retry
    // worker again (it only claims 'pending' and reaps stale 'sending').
    // updated_at is bumped on every status change, so it marks the end of
    // the row's life. One bounded DELETE per status, same style as the
    // analytics_events prune above (no LIMIT — the daily run keeps each
    // batch small).
    const outboxSent = await pool.query(
      `DELETE FROM notification_outbox
       WHERE status = 'sent'
         AND updated_at < NOW() - ($1::text || ' days')::interval`,
      [String(OUTBOX_SENT_RETENTION_DAYS)],
    )
    const outboxDead = await pool.query(
      `DELETE FROM notification_outbox
       WHERE status = 'dead'
         AND updated_at < NOW() - ($1::text || ' days')::interval`,
      [String(OUTBOX_DEAD_RETENTION_DAYS)],
    )
    const geoCache = await pool.query(
      `DELETE FROM geo_cache
       WHERE resolved_at < NOW() - ($1::text || ' days')::interval`,
      [String(GEO_CACHE_RETENTION_DAYS)],
    )
    await recordCronRun('analytics-retention', 'ok')
    return NextResponse.json({
      ok: true,
      deleted: result.rowCount ?? 0,
      deletedOutboxSent: outboxSent.rowCount ?? 0,
      deletedOutboxDead: outboxDead.rowCount ?? 0,
      deletedGeoCache: geoCache.rowCount ?? 0,
    })
  } catch (e) {
    await recordCronRun('analytics-retention', 'error', (e as Error).message)
    // A dead analytics-retention lets analytics_events grow without bound —
    // ping the admin, not just the logs.
    void reportError('cron.analytics-retention', e, { alertAdmin: true })
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
