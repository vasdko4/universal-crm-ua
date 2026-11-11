import { tryAdvisoryLock, type AdvisoryLock } from '@/lib/db/advisory-lock'

/**
 * Single-flight lock for the 6 registry cron jobs (audit A4/A5, 3.4.93).
 *
 * The in-process scheduler (lib/cron/scheduler.ts) only locks the *trigger*:
 * it holds `cron:<id>` while it fetches the route, and a direct call with
 * CRON_SECRET, a Vercel Cron firing, or an admin "Run now" never takes that
 * lock at all — so two entry points could run the same job at once. The
 * lock that matters for the *job* therefore lives here, in the route
 * handler: every trigger (scheduler fetch, Vercel Cron, direct call,
 * "Run now") serializes on the same advisory lock, and a second concurrent
 * trigger gets a clear "already running" answer instead of a duplicate run.
 *
 * Key deliberately differs from the scheduler's trigger lock
 * (`cron:<id>`): the scheduler holds its trigger lock for the whole fetch,
 * so a route handler taking the same key would always see it as taken
 * (advisory locks are session-level) and every scheduler-triggered run
 * would be rejected. `cron-run:<id>` is the execution lock; `cron:<id>`
 * stays as the scheduler's trigger pre-check.
 *
 * The lock is released in `finally`, so a crash mid-job frees it with the
 * dead session (and a lock-acquire failure throws, never silently skips).
 * This also closes A5: aborting the scheduler's fetch does not stop the
 * server-side job, but the lock lifetime now matches the job, not the
 * fetch, so a re-trigger cannot overlap the orphaned run.
 */
export const CRON_RUN_LOCK_NS = 20261111

export type CronLockOutcome<T> = { acquired: true; result: T } | { acquired: false }

/**
 * Run `fn` under the per-job advisory lock. Returns `{ acquired: false }`
 * (and never calls `fn`) when another trigger already holds the lock.
 * Throws when the lock itself cannot be acquired (e.g. DB down) — the
 * caller turns that into its error response.
 */
export async function withCronLock<T>(jobId: string, fn: () => Promise<T>): Promise<CronLockOutcome<T>> {
  let lock: AdvisoryLock | null = null
  try {
    lock = await tryAdvisoryLock(CRON_RUN_LOCK_NS, `cron-run:${jobId}`)
  } catch (e) {
    throw new Error(`Не вдалося отримати блокування cron-завдання ${jobId}: ${(e as Error).message}`)
  }
  if (!lock) return { acquired: false }
  try {
    return { acquired: true, result: await fn() }
  } finally {
    await lock.release()
  }
}
