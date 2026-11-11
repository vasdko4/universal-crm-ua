import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const source = (file: string) => readFileSync(resolve(root, file), 'utf8')

// The helper itself talks to Postgres via tryAdvisoryLock — mock that one
// function so the unit tests below never touch the DB.
vi.mock('@/lib/db/advisory-lock', () => ({
  tryAdvisoryLock: vi.fn(),
}))

import { tryAdvisoryLock } from '@/lib/db/advisory-lock'
import { withCronLock, CRON_RUN_LOCK_NS } from '@/lib/cron/with-cron-lock'

const mockedTryAdvisoryLock = vi.mocked(tryAdvisoryLock)

const REGISTRY_JOBS = [
  'notification-retry',
  'delivery-sync',
  'analytics-retention',
  'expire-pending',
  'anomaly-alert',
  'db-backup',
] as const

// Audit A4/A5 (3.4.93): every registry cron route must serialize on the
// per-job advisory lock, so a second concurrent trigger (Vercel Cron,
// direct CRON_SECRET call, admin "Run now", scheduler re-fire after an
// abort) gets 409 instead of a duplicate run.
describe('cron route single-flight lock (audit A4/A5)', () => {
  it.each(REGISTRY_JOBS)('route %s goes through withCronLock and answers 409 when busy', (id) => {
    const src = source(`app/api/cron/${id}/route.ts`)
    expect(src).toContain(`withCronLock('${id}'`)
    expect(src).toContain("from '@/lib/cron/with-cron-lock'")
    expect(src).toContain("error: 'cron job already running'")
    expect(src).toContain('{ status: 409 }')
  })

  it('the lock is taken after auth + kill-switch, before the job runs', () => {
    for (const id of REGISTRY_JOBS) {
      const src = source(`app/api/cron/${id}/route.ts`)
      const authAt = src.indexOf('authorizeCronRequest')
      const killAt = src.indexOf('isCronJobEnabled')
      const lockAt = src.indexOf(`withCronLock('${id}'`)
      expect(authAt).toBeGreaterThan(-1)
      expect(killAt).toBeGreaterThan(authAt)
      expect(lockAt).toBeGreaterThan(killAt)
    }
  })

  it('prom-sync is untouched: its lock already lives inside syncPromProducts', () => {
    const src = source('app/api/cron/prom-sync/route.ts')
    expect(src).not.toContain('withCronLock')
    expect(src).toContain('syncPromProducts')
  })

  it('the scheduler keeps its own trigger lock (pre-check), unchanged', () => {
    const src = source('lib/cron/scheduler.ts')
    expect(src).toContain('tryAdvisoryLock(SCHEDULER_LOCK_NS, `cron:${id}`)')
    expect(src).not.toContain('withCronLock')
  })

  it('the helper uses the scheduler namespace with a distinct run key', () => {
    const src = source('lib/cron/with-cron-lock.ts')
    expect(src).toContain('export const CRON_RUN_LOCK_NS = 20261111')
    expect(src).toContain('`cron-run:${jobId}`')
    // Released in finally, so a crash mid-job frees the lock.
    expect(src).toContain('await lock.release()')
    expect(CRON_RUN_LOCK_NS).toBe(20261111)
  })

  it('the stale 300s-ceiling comment is gone from the scheduler', () => {
    const src = source('lib/cron/scheduler.ts')
    expect(src).not.toContain('Cron routes run up to a 300s ceiling')
  })
})

describe('withCronLock', () => {
  beforeEach(() => {
    mockedTryAdvisoryLock.mockReset()
  })

  it('runs fn under the lock and releases it afterwards', async () => {
    const release = vi.fn()
    mockedTryAdvisoryLock.mockResolvedValue({ release })
    const fn = vi.fn(async () => 'done')

    await expect(withCronLock('db-backup', fn)).resolves.toEqual({ acquired: true, result: 'done' })
    expect(mockedTryAdvisoryLock).toHaveBeenCalledWith(20261111, 'cron-run:db-backup')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('releases the lock even when fn throws', async () => {
    const release = vi.fn()
    mockedTryAdvisoryLock.mockResolvedValue({ release })

    await expect(withCronLock('anomaly-alert', async () => {
      throw new Error('boom')
    })).rejects.toThrow('boom')
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('a second concurrent trigger is rejected without running fn', async () => {
    const release = vi.fn()
    mockedTryAdvisoryLock
      .mockImplementationOnce(async () => ({ release }))
      .mockImplementationOnce(async () => null)
    let resolveFn!: (value: string) => void
    const fn = vi.fn(() => new Promise<string>((r) => { resolveFn = r }))

    const firstP = withCronLock('db-backup', fn)
    // Let the first call acquire the lock and enter fn.
    await new Promise((r) => setTimeout(r, 0))

    await expect(withCronLock('db-backup', fn)).resolves.toEqual({ acquired: false })
    expect(fn).toHaveBeenCalledTimes(1)

    resolveFn('done')
    await expect(firstP).resolves.toEqual({ acquired: true, result: 'done' })
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('a lock-acquire failure throws a clear error', async () => {
    mockedTryAdvisoryLock.mockRejectedValue(new Error('connection refused'))
    await expect(withCronLock('delivery-sync', async () => 'x')).rejects.toThrow(
      'Не вдалося отримати блокування cron-завдання delivery-sync',
    )
  })
})
