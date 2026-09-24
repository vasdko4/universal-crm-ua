import { NextResponse, type NextRequest } from 'next/server'
import { authorizeCronRequest } from '@/lib/cron-auth'
import { expirePendingPayments } from '@/lib/payments/expire-pending'

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

  try {
    const result = await expirePendingPayments()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    console.error('[cron] expire-pending failed:', (e as Error).message)
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
