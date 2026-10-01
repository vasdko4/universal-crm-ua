import { NextResponse, type NextRequest } from 'next/server'
import { authorizeCronRequest } from '@/lib/cron-auth'
import { reportError } from '@/lib/server-errors'
import { runAnomalyCheck } from '@/lib/analytics/anomaly'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Vercel Cron endpoint (see vercel.json) that watches for shop anomalies and
 * pings the admin Telegram chat:
 *   - zero orders in the last N hours during daytime (Europe/Kyiv),
 *   - a spike of cancellations/refunds over 24h vs the 7-day baseline.
 * Thresholds are env-configurable (see .env.example, ANOMALY_*).
 *
 * Runs every 2 hours during the day; the check itself re-verifies the Kyiv
 * daytime window so a shifted cron schedule cannot page the admin at night.
 *
 * SECURITY: same fail-closed model as the other cron routes — without a
 * usable CRON_SECRET the endpoint refuses every request (503), a wrong or
 * missing header gets 401.
 */
export async function GET(req: NextRequest) {
  const auth = authorizeCronRequest(process.env.CRON_SECRET, req.headers.get('authorization'))
  if (!auth.ok) {
    if (auth.status === 503) {
      console.error(
        '[cron] CRON_SECRET is not set (or is still a placeholder) — refusing to run anomaly-alert unauthenticated.',
      )
    }
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  try {
    const result = await runAnomalyCheck()
    return NextResponse.json(result, { status: result.ok ? 200 : 500 })
  } catch (e) {
    // A dead anomaly cron means the admin stops hearing about a broken
    // checkout — ping, not just logs.
    void reportError('cron.anomaly-alert', e, { alertAdmin: true })
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
