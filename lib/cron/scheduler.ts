/**
 * In-process scheduler for the cron job registry.
 *
 * The store runs on a single Docker VPS (not Vercel), so Vercel Cron does
 * not apply. This ticker (started from instrumentation.ts, every 60s) runs
 * jobs from lib/cron/registry.ts when they are enabled in the cron_jobs
 * table and their interval has elapsed since the last run.
 *
 * Jobs are triggered over HTTP to localhost (same pattern as an external
 * cron hitting /api/cron/<id>), so the existing CRON_SECRET auth and route
 * logic are reused untouched. Disabled jobs are skipped here AND refused
 * by the routes themselves (fail closed).
 *
 * prom-sync is intentionally excluded — it has its own settings-driven
 * scheduler in lib/prom/scheduler.ts.
 */

import { pool } from '@/lib/db'
import { CRON_JOBS } from './registry'
import { isCronJobEnabled, recordCronRun } from './store'

const TICK_MS = 60_000
let started = false
const runningJobs = new Set<string>()

function baseUrl(): string {
  const port = process.env.PORT || '3000'
  return `http://127.0.0.1:${port}`
}

async function runJob(id: string): Promise<void> {
  if (runningJobs.has(id)) return
  runningJobs.add(id)
  try {
    const secret = process.env.CRON_SECRET
    if (!secret) {
      await recordCronRun(id, 'error', 'CRON_SECRET is not set')
      return
    }
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 55_000)
    try {
      const res = await fetch(`${baseUrl()}/api/cron/${id}`, {
        headers: { Authorization: `Bearer ${secret}` },
        signal: ctrl.signal,
      })
      if (res.ok) {
        await recordCronRun(id, 'ok')
        console.log(`[cron-scheduler] ${id}: ok`)
      } else {
        const text = (await res.text()).slice(0, 200)
        await recordCronRun(id, 'error', `HTTP ${res.status}: ${text}`)
        console.error(`[cron-scheduler] ${id}: HTTP ${res.status}`)
      }
    } finally {
      clearTimeout(timer)
    }
  } catch (e) {
    const msg = (e as Error).message.slice(0, 200)
    await recordCronRun(id, 'error', msg)
    console.error(`[cron-scheduler] ${id} failed:`, msg)
  } finally {
    runningJobs.delete(id)
  }
}

async function tick(): Promise<void> {
  // On Vercel, vercel.json Cron handles scheduling — don't double-run.
  if (process.env.VERCEL) return
  const now = Date.now()
  let states: Map<string, string | null>
  try {
    const { rows } = await pool.query(`SELECT id, last_run_at FROM cron_jobs`)
    states = new Map(rows.map((r) => [String(r.id), r.last_run_at ? String(r.last_run_at) : null]))
  } catch {
    return
  }
  for (const job of CRON_JOBS) {
    try {
      if (!(await isCronJobEnabled(job.id))) continue
      const lastRaw = states.get(job.id)
      const last = lastRaw ? Date.parse(lastRaw) : NaN
      if (!Number.isFinite(last)) {
        // Never ran and no timestamp (e.g. row created before the
        // last_run_at=NOW() default): stamp now and wait for the next
        // interval instead of firing everything at once. Status stays
        // empty — the job hasn't actually run yet.
        try {
          await pool.query(
            `UPDATE cron_jobs SET last_run_at = NOW(), updated_at = NOW() WHERE id = $1`,
            [job.id],
          )
        } catch {
          // Best effort.
        }
        continue
      }
      if (now - last < job.intervalMs) continue
      // Fire and forget — runJob tracks its own in-flight set.
      void runJob(job.id)
    } catch (e) {
      console.error(`[cron-scheduler] tick error for ${job.id}:`, (e as Error).message)
    }
  }
}

/** Start the minute-tick. Idempotent; never throws. */
export function startCronScheduler(): void {
  if (started) return
  started = true
  if (process.env.VITEST) return
  if (process.env.VERCEL) return
  try {
    const timer = setInterval(() => {
      tick().catch((e) => console.error('[cron-scheduler] tick failed:', (e as Error).message))
    }, TICK_MS)
    const t = timer as unknown as { unref?: () => void }
    if (typeof t.unref === 'function') t.unref()
    console.log('[cron-scheduler] started (60s tick)')
  } catch (e) {
    console.error('[cron-scheduler] failed to start:', (e as Error).message)
  }
}
