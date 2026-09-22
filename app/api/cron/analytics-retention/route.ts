import { NextResponse, type NextRequest } from 'next/server'
import { pool } from '@/lib/db'
import { authorizeCronRequest } from '@/lib/cron-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const RETENTION_DAYS = 90

/**
 * Drops storefront analytics_events older than 90 days so `/api/track`
 * cannot grow the table without bound (FIX-32).
 */
export async function GET(req: NextRequest) {
  const auth = authorizeCronRequest(process.env.CRON_SECRET, req.headers.get('authorization'))
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  try {
    const result = await pool.query(
      `DELETE FROM analytics_events
       WHERE created_at < NOW() - ($1::text || ' days')::interval
         AND type IN ('pageview', 'product_view', 'add_to_cart')`,
      [String(RETENTION_DAYS)],
    )
    return NextResponse.json({ ok: true, deleted: result.rowCount ?? 0 })
  } catch (e) {
    console.error('[cron] analytics-retention failed:', (e as Error).message)
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
