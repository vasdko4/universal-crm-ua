/**
 * Anomaly detection for the admin Telegram alerts (see
 * app/api/cron/anomaly-alert/route.ts).
 *
 * Two checks, both deliberately conservative — a false alarm at 3am costs
 * more trust than a missed edge case:
 *   1. zero orders in the last N hours while the shop is "open"
 *      (Europe/Kyiv daytime window, env-configurable);
 *   2. a spike of cancellations/refunds over the last 24h relative to the
 *      trailing 7-day daily baseline.
 *
 * The decision math is pure (evaluateAnomalies) and unit-tested; DB reads and
 * the Telegram send live in runAnomalyCheck so the cron route stays thin.
 */

import { pool } from '@/lib/db'
import { getStoreSettingsInternal } from '@/lib/store-settings'
import { sendTelegramMessage } from '@/lib/notifications'
import { reportError } from '@/lib/server-errors'

export const SHOP_TZ = 'Europe/Kyiv'

export type AnomalyConfig = {
  /** "No orders" window, hours. */
  zeroOrderHours: number
  /** Daytime window (Europe/Kyiv hours) when zero orders are suspicious. */
  dayStartHour: number
  dayEndHour: number
  /** cancel/refund spike: 24h count >= baseline * multiplier ... */
  cancelSpikeMultiplier: number
  /** ... and >= this absolute floor, so a tiny shop is not paged over 2 vs 1. */
  cancelSpikeMin: number
}

const DEFAULT_CONFIG: AnomalyConfig = {
  zeroOrderHours: 6,
  dayStartHour: 8,
  dayEndHour: 23,
  cancelSpikeMultiplier: 2,
  cancelSpikeMin: 5,
}

function numEnv(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const v = Number(env[key])
  return Number.isFinite(v) && v > 0 ? v : fallback
}

export function readAnomalyConfig(env: NodeJS.ProcessEnv = process.env): AnomalyConfig {
  return {
    zeroOrderHours: numEnv(env, 'ANOMALY_ZERO_ORDER_HOURS', DEFAULT_CONFIG.zeroOrderHours),
    dayStartHour: numEnv(env, 'ANOMALY_DAY_START', DEFAULT_CONFIG.dayStartHour),
    dayEndHour: numEnv(env, 'ANOMALY_DAY_END', DEFAULT_CONFIG.dayEndHour),
    cancelSpikeMultiplier: numEnv(env, 'ANOMALY_CANCEL_SPIKE_MULTIPLIER', DEFAULT_CONFIG.cancelSpikeMultiplier),
    cancelSpikeMin: numEnv(env, 'ANOMALY_CANCEL_SPIKE_MIN', DEFAULT_CONFIG.cancelSpikeMin),
  }
}

/** Current hour (0-23) in the shop timezone. */
export function kyivHour(date: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SHOP_TZ,
    hour: 'numeric',
    hour12: false,
  }).formatToParts(date)
  const h = Number(parts.find((p) => p.type === 'hour')?.value)
  // '24' is midnight in some ICU versions — normalize to 0.
  return h === 24 ? 0 : h
}

export function isDaytime(date: Date, config: AnomalyConfig): boolean {
  const h = kyivHour(date)
  return h >= config.dayStartHour && h < config.dayEndHour
}

export type AnomalyInput = {
  now: Date
  ordersLastNHours: number
  cancelsLast24h: number
  /** Trailing 7-day average of daily cancellations+refunds. */
  baselineDailyCancels: number
  config: AnomalyConfig
}

export type AnomalyAlert = {
  kind: 'zero_orders' | 'cancel_spike'
  title: string
  details: string
}

export function evaluateAnomalies(input: AnomalyInput): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = []
  const { config } = input

  // Check 1: dead shop during the day. Outside the daytime window the shop
  // is expected to be quiet, so no alert (the cron still runs the spike
  // check below).
  if (isDaytime(input.now, config) && input.ordersLastNHours <= 0) {
    alerts.push({
      kind: 'zero_orders',
      title: 'Нуль замовлень',
      details: `Жодного замовлення за останні ${config.zeroOrderHours} год у денний час (${config.dayStartHour}:00–${config.dayEndHour}:00 за Києвом). Можливо, впав чекаут або оплата.`,
    })
  }

  // Check 2: cancellation/refund spike vs the 7-day baseline. Needs both the
  // absolute floor and the relative jump — either alone is too noisy.
  const baseline = Math.max(0, input.baselineDailyCancels)
  if (
    input.cancelsLast24h >= config.cancelSpikeMin &&
    input.cancelsLast24h >= baseline * config.cancelSpikeMultiplier
  ) {
    alerts.push({
      kind: 'cancel_spike',
      title: 'Сплеск скасувань/повернень',
      details: `Скасувань і повернень за 24 год: ${input.cancelsLast24h} (базова лінія: ${baseline.toFixed(1)}/день). Варто перевірити причини.`,
    })
  }

  return alerts
}

export type AnomalyCheckResult = {
  ok: boolean
  alerts: AnomalyAlert[]
  telegramSent: boolean
  skippedNight: boolean
}

/**
 * Runs both anomaly checks against the DB and pings the admin Telegram chat
 * when something fires. Best-effort: failures are reported, never thrown.
 */
export async function runAnomalyCheck(now: Date = new Date()): Promise<AnomalyCheckResult> {
  const config = readAnomalyConfig()
  try {
    const [ordersRes, cancelsRes, baselineRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS c FROM orders
          WHERE status NOT IN ('cancelled', 'pending_payment')
            AND created_at >= NOW() - ($1 || ' hours')::interval`,
        [String(config.zeroOrderHours)],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS c FROM orders
          WHERE (status = 'cancelled' OR payment_status = 'refunded')
            AND created_at >= NOW() - interval '24 hours'`,
        [],
      ),
      pool.query(
        `SELECT COALESCE(AVG(cnt), 0)::float AS avg FROM (
           SELECT COUNT(*)::int AS cnt
             FROM orders
            WHERE (status = 'cancelled' OR payment_status = 'refunded')
              AND created_at >= NOW() - interval '8 days'
              AND created_at < NOW() - interval '1 day'
            GROUP BY date_trunc('day', created_at AT TIME ZONE '${SHOP_TZ}')
         ) t`,
        [],
      ),
    ])

    const alerts = evaluateAnomalies({
      now,
      ordersLastNHours: ordersRes.rows[0]?.c ?? 0,
      cancelsLast24h: cancelsRes.rows[0]?.c ?? 0,
      baselineDailyCancels: baselineRes.rows[0]?.avg ?? 0,
      config,
    })

    let telegramSent = false
    if (alerts.length > 0) {
      const settings = await getStoreSettingsInternal()
      const n = settings.notifications
      if (n.telegramEnabled && n.telegramBotToken && n.telegramChatId) {
        const text =
          `⚠️ <b>Аномалія в магазині</b>\n\n` +
          alerts.map((a) => `<b>${escapeHtml(a.title)}</b>\n${escapeHtml(a.details)}`).join('\n\n')
        telegramSent = await sendTelegramMessage(n.telegramBotToken, n.telegramChatId, text)
      }
    }

    return { ok: true, alerts, telegramSent, skippedNight: false }
  } catch (e) {
    void reportError('cron.anomaly-alert', e, { alertAdmin: true })
    return { ok: false, alerts: [], telegramSent: false, skippedNight: false }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
