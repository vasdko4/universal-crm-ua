import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')
// Structural tests compare source text with LF literals; normalize so the
// file also passes on a Windows CRLF checkout.
const source = (file: string) => readFileSync(resolve(root, file), 'utf8').replace(/\r\n/g, '\n')

// Audit A11/A12/A13 (3.4.94): delivery-status update + outbox enqueue must
// be atomic, partial runs must not report ok, and the CAS must cover every
// field the write derives from the stale page read.
describe('delivery sync (audit A11/A12/A13)', () => {
  const src = source('lib/delivery/sync-tracking.ts')

  it('A11: status UPDATE and outbox INSERT share one transaction', () => {
    const connectAt = src.indexOf('await pool.connect()')
    const beginAt = src.indexOf("await client.query('BEGIN')", connectAt)
    const updateAt = src.indexOf('UPDATE orders SET delivery_status', beginAt)
    const insertAt = src.indexOf('INSERT INTO notification_outbox', updateAt)
    const commitAt = src.indexOf("await client.query('COMMIT')", insertAt)
    expect(connectAt).toBeGreaterThan(-1)
    expect(beginAt).toBeGreaterThan(connectAt)
    expect(updateAt).toBeGreaterThan(beginAt)
    expect(insertAt).toBeGreaterThan(updateAt)
    expect(commitAt).toBeGreaterThan(insertAt)
    // Failed enqueue rolls the status back; the client is always released.
    expect(src).toContain("await client.query('ROLLBACK')")
    expect(src).toContain('client.release()')
    // The INSERT is inline (same row shape as enqueueNotification) — the
    // outbox write must share the status transaction, so the helper that
    // uses pool directly is not called here.
    expect(src).not.toContain('await enqueueNotification(')
    expect(src.slice(insertAt, insertAt + 400)).toContain(
      "VALUES ('delivery-status', 'customer-email', $1, 'pending')",
    )
    expect(src.slice(insertAt, insertAt + 400)).toContain(
      'ON CONFLICT (kind, channel, order_id) WHERE status = \'pending\' DO NOTHING',
    )
  })

  it('A11: counts change only after COMMIT, and rowCount 0 still skips', () => {
    const commitAt = src.indexOf("await client.query('COMMIT')")
    const updatedAt = src.indexOf('result.updated++', commitAt)
    const emailedAt = src.indexOf('if (willEmail) result.emailed++', commitAt)
    expect(updatedAt).toBeGreaterThan(commitAt)
    expect(emailedAt).toBeGreaterThan(commitAt)
    // CAS miss rolls back and skips — the next run re-reads fresh.
    expect(src).toContain('if (res.rowCount === 0) {')
  })

  it('A12: any recorded error flips ok to false and pages the admin', () => {
    const tailAt = src.indexOf('if (result.errors.length > 0) {')
    const returnAt = src.indexOf('return result', tailAt)
    expect(tailAt).toBeGreaterThan(-1)
    expect(returnAt).toBeGreaterThan(tailAt)
    const tail = src.slice(tailAt, returnAt)
    expect(tail).toContain('result.ok = false')
    expect(tail).toContain("reportError(\n      'cron.delivery-sync-partial',")
    expect(tail).toContain('alertAdmin: true')
  })

  it('A13: the CAS covers delivery_status, status and tracking_number', () => {
    const updateAt = src.indexOf('UPDATE orders SET delivery_status')
    const updateSql = src.slice(updateAt, updateAt + 600)
    expect(updateSql).toContain('AND delivery_status IS NOT DISTINCT FROM $4')
    expect(updateSql).toContain('AND status = $5')
    expect(updateSql).toContain('AND tracking_number IS NOT DISTINCT FROM $6')
    // The guarded values come from the stale page row.
    expect(src).toContain('row.delivery_status ?? null')
    expect(src).toContain('row.status,')
    expect(src).toContain('row.tracking_number ?? null')
  })
})
