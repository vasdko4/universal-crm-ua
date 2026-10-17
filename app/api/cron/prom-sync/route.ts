import { NextResponse, type NextRequest } from 'next/server'
import { syncPromProducts } from '@/lib/prom/sync'
import { authorizeCronRequest } from '@/lib/cron-auth'
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

  try {
    const result = await syncPromProducts()
    return NextResponse.json(result, { status: result.ok ? 200 : 422 })
  } catch (e) {
    void reportError('cron.prom-sync', e, { alertAdmin: true })
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
