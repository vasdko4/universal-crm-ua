import { NextResponse, type NextRequest } from 'next/server'
import { authorizeCronRequest } from '@/lib/cron-auth'
import { isCronJobEnabled, recordCronRun } from '@/lib/cron/store'
import { withCronLock } from '@/lib/cron/with-cron-lock'
import { expirePendingPayments } from '@/lib/payments/expire-pending'
import { reportError } from '@/lib/server-errors'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Cancels storefront orders that stayed in pending_payment after the gateway
 * window (FIX-07). Probes WayForPay/Monobank first so a late paid webhook is
 * not overwritten. Vercel Hobby only allows daily crons, so this runs once a
 * day; the 45-minute age check still drops anything older than that window.
 */
export async function GET(req: NextRequest) {
  const auth = authorizeCronRequest(process.env.CRON_SECRET, req.headers.get('authorization'))
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  // Admin Cron tab kill-switch: disabled jobs refuse to run (fail closed).
  if (!(await isCronJobEnabled('expire-pending'))) {
    return NextResponse.json({ ok: false, error: 'cron job disabled' }, { status: 503 })
  }

  // Single-flight (audit A4/A5): a second concurrent trigger — Vercel
  // Cron, direct CRON_SECRET call, admin "Run now" — gets 409 instead of
  // a duplicate run. Auth + kill-switch stay first (cheap checks before
  // taking the lock).
  const locked = await withCronLock('expire-pending', async () => {
    try {
      const result = await expirePendingPayments()
      await recordCronRun('expire-pending', 'ok')
      return NextResponse.json({ ok: true, ...result })
    } catch (e) {
      await recordCronRun('expire-pending', 'error', (e as Error).message)
      // A dead expire-pending leaves pending_payment orders stuck (stock held,
      // orders never cancelled) — ping the admin, not just the logs.
      void reportError('cron.expire-pending', e, { alertAdmin: true })
      return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
    }
  })
  if (!locked.acquired) {
    return NextResponse.json({ ok: false, error: 'cron job already running' }, { status: 409 })
  }
  return locked.result
}
