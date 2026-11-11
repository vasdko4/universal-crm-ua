import { NextResponse, type NextRequest } from 'next/server'
import { processNotificationOutbox } from '@/lib/notifications'
import { authorizeCronRequest } from '@/lib/cron-auth'
import { isCronJobEnabled, recordCronRun } from '@/lib/cron/store'
import { withCronLock } from '@/lib/cron/with-cron-lock'
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

  // Single-flight (audit A4/A5): a second concurrent trigger — Vercel
  // Cron, direct CRON_SECRET call, admin "Run now" — gets 409 instead of
  // a duplicate run. Auth + kill-switch stay first (cheap checks before
  // taking the lock).
  const locked = await withCronLock('notification-retry', async () => {
    try {
      const result = await processNotificationOutbox()
      await recordCronRun('notification-retry', 'ok')
      return NextResponse.json({ ok: true, ...result })
    } catch (e) {
      await recordCronRun('notification-retry', 'error', (e as Error).message)
      void reportError('cron.notification-retry', e)
      return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
    }
  })
  if (!locked.acquired) {
    return NextResponse.json({ ok: false, error: 'cron job already running' }, { status: 409 })
  }
  return locked.result
}
