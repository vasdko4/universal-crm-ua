import { NextResponse, type NextRequest } from 'next/server'
import { syncNovaPoshtaTracking } from '@/lib/delivery/sync-tracking'
import { authorizeCronRequest } from '@/lib/cron-auth'

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

  try {
    const result = await syncNovaPoshtaTracking()
    return NextResponse.json(result, { status: result.ok ? 200 : 422 })
  } catch (e) {
    console.log('[v0] delivery-sync cron failed:', (e as Error).message)
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
