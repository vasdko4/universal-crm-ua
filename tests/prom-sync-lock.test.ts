import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const source = (file: string) => readFileSync(resolve(root, file), 'utf8')

describe('prom-sync single-flight lock', () => {
  it('syncPromProducts acquires the advisory lock and releases it in finally', () => {
    const src = source('lib/prom/sync.ts')
    expect(src).toContain('tryAdvisoryLock(PROM_SYNC_LOCK_NS, PROM_SYNC_LOCK_KEY)')
    // Lock identity unchanged from the scheduler era.
    expect(src).toContain('const PROM_SYNC_LOCK_NS = 20261111')
    expect(src).toContain("const PROM_SYNC_LOCK_KEY = 'prom-sync'")
    expect(src).toContain("reason: 'Синхронізація Prom уже виконується'")
    const runAt = src.indexOf('await runSyncPromProducts(cfg, token, result)')
    const releaseAt = src.indexOf('await lock.release()')
    expect(runAt).toBeGreaterThan(-1)
    expect(releaseAt).toBeGreaterThan(runAt)
  })

  it('the scheduler no longer acquires its own lock (exactly one acquisition per run)', () => {
    const src = source('lib/prom/scheduler.ts')
    expect(src).not.toContain('tryAdvisoryLock')
    expect(src).not.toContain('SCHEDULER_LOCK_NS')
    expect(src).toContain('syncPromProducts()')
  })

  it('all three entry points go through syncPromProducts', () => {
    for (const file of [
      'lib/prom/scheduler.ts',
      'app/actions/prom.ts',
      'app/api/cron/prom-sync/route.ts',
    ]) {
      expect(source(file)).toContain('syncPromProducts')
    }
  })
})
