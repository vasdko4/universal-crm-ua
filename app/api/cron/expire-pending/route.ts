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
 * not overwritten. On the Docker VPS the in-process scheduler runs this
 * every 15 minutes (registry interval), so the 45-minute age check is the
 * effective threshold; Vercel Hobby only allows daily crons, so the Vercel
 * schedule is still once a day (04:30 UTC). The same run sweeps expired
 * promo reservations (3.4.109 backstop — lazy reap is primary).
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
      // 3.4.109 backstop: expirePendingPayments cancels stale pending_payment
      // orders, but their promo reservations live in promotion_reservations
      // — sweep expired holds (status -> 'expired', slot freed) in the same
      // pass. Lazy reap at the next checkout for the same promotion is the
      // primary mechanism; this only frees holds no shopper has reaped yet.
      const { sweepExpiredReservations } = await import('@/lib/shop/promo-usage')
      const { swept } = await sweepExpiredReservations()
      await recordCronRun('expire-pending', 'ok')
      return NextResponse.json({ ok: true, ...result, reservationsSwept: swept })
    } catch (e) {
      await recordCronRun('expire-pending', 'error', (e as Error).message)
      // A dead expire-pending leaves stale pending_payment orders lingering
      // (no stock is held by unpaid orders — stock is deducted only at
      // payment — but the orders stay visible in admin and their gateway
      // invoices may still be payable) — ping the admin, not just the logs.
      void reportError('cron.expire-pending', e, { alertAdmin: true })
      return NextResponse.json({ ok: false, error: 'Внутрішня помилка' }, { status: 500 })
    }
  })
  if (!locked.acquired) {
    return NextResponse.json({ ok: false, error: 'cron job already running' }, { status: 409 })
  }
  return locked.result
}
