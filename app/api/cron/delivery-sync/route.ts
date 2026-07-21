import { NextResponse, type NextRequest } from 'next/server'
import { syncNovaPoshtaTracking } from '@/lib/delivery/sync-tracking'

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
 * SECURITY: this used to fail OPEN — if CRON_SECRET was left unset, the
 * endpoint ran for anyone who requested the URL, no auth required. That
 * silently burned Nova Poshta API quota and could spam customers with
 * delivery-status emails on every hit. It now fails CLOSED instead: without a
 * configured secret the endpoint refuses all requests (matching the warning
 * already documented in .env.example) instead of quietly running unprotected.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron] CRON_SECRET is not set — refusing to run delivery-sync unauthenticated.')
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET is not configured' },
      { status: 503 },
    )
  }
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await syncNovaPoshtaTracking()
    return NextResponse.json(result, { status: result.ok ? 200 : 422 })
  } catch (e) {
    console.log('[v0] delivery-sync cron failed:', (e as Error).message)
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
