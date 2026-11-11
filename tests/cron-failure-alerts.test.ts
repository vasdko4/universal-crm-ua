import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '..')
const read = (rel: string) => readFileSync(join(root, rel), 'utf8')

describe('cron failure alerts (second code review)', () => {
  it('expire-pending reports failures to the admin, like its siblings', () => {
    const route = read('app/api/cron/expire-pending/route.ts')
    expect(route).toContain("import { reportError } from '@/lib/server-errors'")
    expect(route).toContain("void reportError('cron.expire-pending', e, { alertAdmin: true })")
    // reportError already writes the structured console.error line — no
    // bare console-only failure path like before.
    expect(route).not.toContain("console.error('[cron] expire-pending failed:'")
  })

  it('analytics-retention reports failures to the admin, like its siblings', () => {
    const route = read('app/api/cron/analytics-retention/route.ts')
    expect(route).toContain("import { reportError } from '@/lib/server-errors'")
    expect(route).toContain("void reportError('cron.analytics-retention', e, { alertAdmin: true })")
    expect(route).not.toContain("console.error('[cron] analytics-retention failed:'")
  })

  it('per-product analytics excludes unpaid pending_payment orders like every other report', () => {
    const src = read('app/actions/analytics.ts')
    const start = src.indexOf('export async function getProductAnalytics')
    expect(start).toBeGreaterThan(-1)
    const fn = src.slice(start, src.indexOf('\nexport async function', start + 10))
    // Audit P1, 3.4.96: the literal predicate moved into the shared
    // financialOrdersWhere() helper, which keeps this exclusion and
    // additionally drops fully-refunded orders.
    expect(fn).toContain("AND ${financialOrdersWhere('o')}")
    // The old predicate survives only inside the BUGFIX comment, never as code.
    expect(fn).not.toContain("AND o.status <> 'cancelled'")
  })
})
