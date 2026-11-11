import { NextResponse, type NextRequest } from 'next/server'
import { processNotificationOutbox } from '@/lib/notifications'
import { authorizeCronRequest } from '@/lib/cron-auth'
import { isCronJobEnabled, recordCronRun } from '@/lib/cron/store'
import { reportError } from '@/lib/server-errors'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Retries failed order notifications from notification_outbox (audit item 33).
 * Runs every 15 minutes via the in-process scheduler (and Vercel Cron, see
 * vercel.json). Same auth and kill-switch pattern as the other cron routes:
 * CRON_SECRET bearer + the admin Cron tab toggle, fail closed.
 */
export async function GET(req: NextRequest) {
  const auth = authorizeCronRequest(process.env.CRON_SECRET, req.headers.get('authorization'))
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  // Admin Cron tab kill-switch: disabled jobs refuse to run (fail closed).
  if (!(await isCronJobEnabled('notification-retry'))) {
    return NextResponse.json({ ok: false, error: 'cron job disabled' }, { status: 503 })
  }

  try {
    const result = await processNotificationOutbox()
    await recordCronRun('notification-retry', 'ok')
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    await recordCronRun('notification-retry', 'error', (e as Error).message)
    void reportError('cron.notification-retry', e)
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
