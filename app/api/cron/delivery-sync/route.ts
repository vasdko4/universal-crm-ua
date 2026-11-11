import { NextResponse, type NextRequest } from 'next/server'
import { syncNovaPoshtaTracking } from '@/lib/delivery/sync-tracking'
import { authorizeCronRequest } from '@/lib/cron-auth'
import { isCronJobEnabled, recordCronRun } from '@/lib/cron/store'
import { withCronLock } from '@/lib/cron/with-cron-lock'
import { reportError } from '@/lib/server-errors'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Hourly Vercel Cron endpoint (see vercel.json) that refreshes Nova Poshta
 * delivery statuses for in-flight orders and emails customers about changes.
 *
 * Requests must carry "Authorization: Bearer <CRON_SECRET>" — Vercel Cron
 * adds it automatically once CRON_SECRET is set in the project's environment
 * variables.
 *
 * SECURITY: this fails CLOSED (see lib/cron-auth.ts). Without a usable secret
 * the endpoint refuses every request with 503 instead of running
 * unauthenticated; a wrong or missing header gets 401. An unprotected run
 * would burn the Nova Poshta API quota, write to the database and email
 * customers on every hit. Well-known placeholders (a copied .env.example)
 * count as "not configured" on purpose.
 */
export async function GET(req: NextRequest) {
  const auth = authorizeCronRequest(process.env.CRON_SECRET, req.headers.get('authorization'))
  if (!auth.ok) {
    if (auth.status === 503) {
      console.error(
        '[cron] CRON_SECRET is not set (or is still a placeholder) — refusing to run delivery-sync unauthenticated.',
      )
    }
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  // Admin Cron tab kill-switch: disabled jobs refuse to run (fail closed).
  if (!(await isCronJobEnabled('delivery-sync'))) {
    return NextResponse.json({ ok: false, error: 'cron job disabled' }, { status: 503 })
  }

  // Single-flight (audit A4/A5): a second concurrent trigger — Vercel
  // Cron, direct CRON_SECRET call, admin "Run now" — gets 409 instead of
  // a duplicate run. Auth + kill-switch stay first (cheap checks before
  // taking the lock).
  const locked = await withCronLock('delivery-sync', async () => {
    try {
      const result = await syncNovaPoshtaTracking()
      await recordCronRun('delivery-sync', result.ok ? 'ok' : 'error', result.ok ? undefined : 'sync failed')
      return NextResponse.json(result, { status: result.ok ? 200 : 422 })
    } catch (e) {
      // A dead delivery-sync cron means TTNs silently stop updating —
      // ping the admin, not just the logs.
      await recordCronRun('delivery-sync', 'error', (e as Error).message)
      void reportError('cron.delivery-sync', e, { alertAdmin: true })
      return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
    }
  })
  if (!locked.acquired) {
    return NextResponse.json({ ok: false, error: 'cron job already running' }, { status: 409 })
  }
  return locked.result
}
