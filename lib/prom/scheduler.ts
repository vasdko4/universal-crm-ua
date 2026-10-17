/**
 * In-process scheduler for the Prom.ua sync.
 *
 * The store runs on a single Docker VPS (not Vercel), so Vercel Cron does
 * not apply — and asking the owner to wire a system crontab + curl is
 * friction. Instead the Next.js server itself ticks every minute (started
 * from instrumentation.ts) and runs the Prom sync when it is due: the
 * integration is enabled, a token is set, and the configured interval has
 * elapsed since the last run.
 *
 * Out of the box: enable in Настройки → Prom and it just works — no server
 * configuration needed. The /api/cron/prom-sync endpoint stays for manual
 * triggers and Vercel-style cron.
 */

import { pool } from '@/lib/db'
import { syncPromProducts } from './sync'

const TICK_MS = 60_000
let running = false
let started = false

export type PromSchedule = {
  enabled: boolean
  hasToken: boolean
  intervalMinutes: number
  lastSyncAt: string | null
}

/** Pure decision: is a sync due right now? */
export function isPromSyncDue(s: PromSchedule, now: number): boolean {
  if (!s.enabled || !s.hasToken) return false
  const intervalMs = Math.max(5, s.intervalMinutes) * 60_000
  if (!s.lastSyncAt) return true
  const last = Date.parse(s.lastSyncAt)
  if (!Number.isFinite(last)) return true
  return now - last >= intervalMs
}

/**
 * Read the raw prom JSONB straight from the DB, bypassing the 1h settings
 * cache — the scheduler must see toggles the moment they are saved.
 * The token stays encrypted here; we only check its presence.
 */
async function readSchedule(): Promise<PromSchedule | null> {
  try {
    const { rows } = await pool.query(`SELECT prom FROM store_settings WHERE id = 1 LIMIT 1`)
    const prom = (rows[0]?.prom ?? {}) as Record<string, unknown>
    return {
      enabled: prom.enabled === true,
      hasToken: typeof prom.apiToken === 'string' && prom.apiToken.trim() !== '',
      intervalMinutes: Number(prom.syncIntervalMinutes) || 60,
      lastSyncAt: typeof prom.lastSyncAt === 'string' ? prom.lastSyncAt : null,
    }
  } catch (e) {
    console.error('[prom-scheduler] schedule read failed:', (e as Error).message)
    return null
  }
}

async function tick(): Promise<void> {
  if (running) return
  const schedule = await readSchedule()
  if (!schedule || !isPromSyncDue(schedule, Date.now())) return
  running = true
  try {
    const res = await syncPromProducts()
    console.log(`[prom-scheduler] sync finished: ${res.summary ?? res.reason ?? 'done'}`)
  } catch (e) {
    console.error('[prom-scheduler] sync failed:', (e as Error).message)
  } finally {
    running = false
  }
}

/** Start the minute-tick. Idempotent; never throws. */
export function startPromScheduler(): void {
  if (started) return
  started = true
  if (process.env.VITEST) return // no background ticks under unit tests
  try {
    const timer = setInterval(() => {
      tick().catch((e) => console.error('[prom-scheduler] tick failed:', (e as Error).message))
    }, TICK_MS)
    // Don't keep the process alive at shutdown because of this timer.
    const t = timer as unknown as { unref?: () => void }
    if (typeof t.unref === 'function') t.unref()
    console.log('[prom-scheduler] started (60s tick)')
  } catch (e) {
    console.error('[prom-scheduler] failed to start:', (e as Error).message)
  }
}
