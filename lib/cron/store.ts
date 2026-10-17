/**
 * Persistence for the cron job registry (admin Cron tab + scheduler).
 * Table: cron_jobs (id text PK, enabled bool, last_run_at, last_status, last_error).
 * Never throws — scheduler ticks must not die on a DB hiccup.
 */

import { pool } from '@/lib/db'
import { CRON_JOBS } from './registry'

export type CronJobState = {
  id: string
  enabled: boolean
  lastRunAt: string | null
  lastStatus: string | null
  lastError: string | null
}

async function ensureRows(): Promise<void> {
  try {
    for (const j of CRON_JOBS) {
      // last_run_at = NOW() on first insert: a fresh install must NOT fire
      // all jobs at once on the scheduler's first tick — they run on their
      // next scheduled interval instead.
      await pool.query(
        `INSERT INTO cron_jobs (id, enabled, last_run_at) VALUES ($1, true, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [j.id],
      )
    }
  } catch {
    // Table may not exist yet (migration not applied) — callers handle nulls.
  }
}

export async function getCronJobStates(): Promise<CronJobState[]> {
  await ensureRows()
  try {
    const { rows } = await pool.query(
      `SELECT id, enabled, last_run_at, last_status, last_error FROM cron_jobs`,
    )
    const byId = new Map(rows.map((r) => [String(r.id), r]))
    return CRON_JOBS.map((j) => {
      const r = byId.get(j.id)
      return {
        id: j.id,
        enabled: r ? Boolean(r.enabled) : true,
        lastRunAt: r?.last_run_at ? new Date(r.last_run_at).toISOString() : null,
        lastStatus: r?.last_status ? String(r.last_status) : null,
        lastError: r?.last_error ? String(r.last_error) : null,
      }
    })
  } catch {
    return CRON_JOBS.map((j) => ({
      id: j.id,
      enabled: true,
      lastRunAt: null,
      lastStatus: null,
      lastError: null,
    }))
  }
}

export async function isCronJobEnabled(id: string): Promise<boolean> {
  try {
    const { rows } = await pool.query(`SELECT enabled FROM cron_jobs WHERE id = $1`, [id])
    if (rows.length === 0) return true
    return Boolean(rows[0].enabled)
  } catch {
    return true
  }
}

export async function setCronJobEnabled(id: string, enabled: boolean): Promise<void> {
  await pool.query(
    `INSERT INTO cron_jobs (id, enabled, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (id) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = NOW()`,
    [id, enabled],
  )
}

export async function recordCronRun(
  id: string,
  status: 'ok' | 'error',
  error?: string,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO cron_jobs (id, enabled, last_run_at, last_status, last_error, updated_at)
       VALUES ($1, true, NOW(), $2, $3, NOW())
       ON CONFLICT (id) DO UPDATE SET
         last_run_at = NOW(), last_status = EXCLUDED.last_status,
         last_error = EXCLUDED.last_error, updated_at = NOW()`,
      [id, status, error ?? null],
    )
  } catch {
    // Best effort.
  }
}
