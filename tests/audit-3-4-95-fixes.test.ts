import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CRON_JOBS } from '@/lib/cron/registry'

const root = resolve(import.meta.dirname, '..')
// Structural tests compare source text with LF literals; normalize CRLF so
// they also pass on a Windows checkout (see the CRLF fix, 11.11.2026).
const source = (file: string) => readFileSync(resolve(root, file), 'utf8').replace(/\r\n/g, '\n')

describe('audit F2 (3.4.95): expire-pending runs every 15 minutes', () => {
  it('registry interval for expire-pending is QUARTER_HOUR (15 min), not DAY', () => {
    const job = CRON_JOBS.find((j) => j.id === 'expire-pending')
    expect(job).toBeDefined()
    expect(job?.intervalMs).toBe(15 * 60_000)
  })

  it('other daily jobs are untouched', () => {
    const daily = ['delivery-sync', 'analytics-retention', 'anomaly-alert', 'db-backup']
    for (const id of daily) {
      expect(CRON_JOBS.find((j) => j.id === id)?.intervalMs).toBe(24 * 60 * 60_000)
    }
    expect(CRON_JOBS.find((j) => j.id === 'notification-retry')?.intervalMs).toBe(15 * 60_000)
  })

  it('route comment states the 15-min VPS interval and no longer claims stock is held', () => {
    const route = source('app/api/cron/expire-pending/route.ts')
    expect(route).toContain('every 15 minutes')
    expect(route).not.toContain('stock held')
    expect(route).toContain('no stock is held by unpaid orders')
  })
})

describe('audit F3 (3.4.95): updater hardens the secret compare and logs requests', () => {
  const script = source('scripts/updater.py')

  it('compares the updater secret in constant time', () => {
    expect(script).toContain('hmac.compare_digest')
    expect(script).toContain('import hmac')
    expect(script).not.toContain('self.headers.get("X-Updater-Secret") != SECRET')
  })

  it('logs every update request with timestamp, source and result', () => {
    expect(script).toContain('_log_update')
    expect(script).toContain('rejected: not_configured')
    expect(script).toContain('rejected: unauthorized')
    expect(script).toContain('"accepted"')
    expect(script).toContain('client_address')
  })

  it('logs the update outcome (pull/up exit codes, success/failure)', () => {
    expect(script).toContain('pull exit=')
    expect(script).toContain('up exit=')
    expect(script).toContain('done: success')
    expect(script).toContain('done: failure')
  })
})

describe('audit F4 (3.4.95): e2e job timeout has headroom', () => {
  it('e2e workflow timeout is 35 minutes, not 25', () => {
    const workflow = source('.github/workflows/e2e.yml')
    expect(workflow).toContain('timeout-minutes: 35')
    expect(workflow).not.toContain('timeout-minutes: 25')
  })
})
