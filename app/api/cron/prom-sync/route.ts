import { NextResponse, type NextRequest } from 'next/server'
import { syncPromProducts } from '@/lib/prom/sync'
import { authorizeCronRequest } from '@/lib/cron-auth'
import { isCronJobEnabled, recordCronRun } from '@/lib/cron/store'
import { withCronLock } from '@/lib/cron/with-cron-lock'
import { reportError } from '@/lib/server-errors'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Hourly cron endpoint (see vercel.json) that pulls prices, stock and
 * characteristics from the Prom.ua seller API into the engine catalog.
 * Products are matched by `products.prom_id`; only the toggles enabled in
 * Настройки → Prom are applied.
 *
 * Requests must carry "Authorization: Bearer <CRON_SECRET>" — Vercel Cron
 * adds it automatically once CRON_SECRET is set; on the VPS a crontab/
 * systemd timer must send the same header. Fails closed (see lib/cron-auth.ts).
 */
export async function GET(req: NextRequest) {
  const auth = authorizeCronRequest(process.env.CRON_SECRET, req.headers.get('authorization'))
  if (!auth.ok) {
    if (auth.status === 503) {
      console.error(
        '[cron] CRON_SECRET is not set (or is still a placeholder) — refusing to run prom-sync unauthenticated.',
      )
    }
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  // Admin Cron tab kill-switch: disabled jobs refuse to run (fail closed).
  // prom-sync is not in the cron registry (settings-driven schedule), but
  // isCronJobEnabled is free-form — no row means enabled, same as the rest.
  if (!(await isCronJobEnabled('prom-sync'))) {
    return NextResponse.json({ ok: false, error: 'cron job disabled' }, { status: 503 })
  }

  // Single-flight (audit A4/A5): a second concurrent trigger gets 409
  // instead of a duplicate run. Auth + kill-switch stay first (cheap
  // checks before taking the lock). The lock key here is `cron-run:prom-sync`
  // (withCronLock); the inner syncPromProducts lock is a DIFFERENT advisory
  // key (`prom-sync`) guarding the sync itself for ALL entry points
  // (scheduler, manual button, this route) — the two never collide.
  const locked = await withCronLock('prom-sync', async () => {
    try {
      const result = await syncPromProducts()
      await recordCronRun('prom-sync', result.ok ? 'ok' : 'error', result.ok ? undefined : 'sync failed')
      return NextResponse.json(result, { status: result.ok ? 200 : 422 })
    } catch (e) {
      await recordCronRun('prom-sync', 'error', (e as Error).message)
      void reportError('cron.prom-sync', e, { alertAdmin: true })
      return NextResponse.json({ ok: false, error: 'Внутрішня помилка' }, { status: 500 })
    }
  })
  if (!locked.acquired) {
    return NextResponse.json({ ok: false, error: 'cron job already running' }, { status: 409 })
  }
  return locked.result
}
