import { NextResponse, type NextRequest } from 'next/server'
import { authorizeCronRequest } from '@/lib/cron-auth'
import { runDatabaseBackup } from '@/lib/shop/db-backup'
import { reportError } from '@/lib/server-errors'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Nightly PostgreSQL backup → Vercel Blob (private), 10-day retention.
 * Vercel Cron (see vercel.json). Auth: CRON_SECRET Bearer, fail-closed.
 * Dumps are data-only NDJSON+gzip; restore via scripts/db-restore.mjs.
 */
export async function GET(req: NextRequest) {
  const auth = authorizeCronRequest(process.env.CRON_SECRET, req.headers.get('authorization'))
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  try {
    const summary = await runDatabaseBackup()
    return NextResponse.json({ ok: true, ...summary })
  } catch (e) {
    const err = e as Error
    await reportError('cron:db-backup', err, { alertAdmin: true })
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
