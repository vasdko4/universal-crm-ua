'use server'

import { assertPermission, assertWritePermission } from '@/lib/session'
import { getCronJobStates, setCronJobEnabled } from '@/lib/cron/store'
import { CRON_JOBS } from '@/lib/cron/registry'
import { revalidatePath } from 'next/cache'

export type CronJobAdminRow = {
  id: string
  nameKey: string
  descKey: string
  intervalMs: number
  enabled: boolean
  lastRunAt: string | null
  lastStatus: string | null
  lastError: string | null
}

export async function getCronJobsAdmin(): Promise<CronJobAdminRow[]> {
  await assertPermission('system_cron')
  const states = await getCronJobStates()
  const byId = new Map(states.map((s) => [s.id, s]))
  return CRON_JOBS.map((j) => {
    const s = byId.get(j.id)
    return {
      id: j.id,
      nameKey: j.nameKey,
      descKey: j.descKey,
      intervalMs: j.intervalMs,
      enabled: s?.enabled ?? true,
      lastRunAt: s?.lastRunAt ?? null,
      lastStatus: s?.lastStatus ?? null,
      lastError: s?.lastError ?? null,
    }
  })
}

export async function setCronJobEnabledAction(
  id: string,
  enabled: boolean,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertWritePermission('system_cron')
    if (!CRON_JOBS.some((j) => j.id === id)) {
      return { ok: false, error: 'unknown job' }
    }
    await setCronJobEnabled(id, enabled)
    revalidatePath('/admin/cron')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

/**
 * Trigger a job right now via its HTTP endpoint (same path the scheduler
 * uses). Returns the endpoint result.
 */
export async function runCronJobNow(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertWritePermission('system_cron')
    if (!CRON_JOBS.some((j) => j.id === id)) {
      return { ok: false, error: 'unknown job' }
    }
    const secret = process.env.CRON_SECRET
    if (!secret) return { ok: false, error: 'CRON_SECRET is not set' }
    const port = process.env.PORT || '3000'
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 55_000)
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/cron/${id}`, {
        headers: { Authorization: `Bearer ${secret}` },
        signal: ctrl.signal,
      })
      const body = (await res.text()).slice(0, 300)
      revalidatePath('/admin/cron')
      return res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}: ${body}` }
    } finally {
      clearTimeout(timer)
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
