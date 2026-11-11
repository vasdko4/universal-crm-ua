import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isUniqueViolation } from '@/lib/db/errors'

const root = resolve(import.meta.dirname, '..')
const source = (file: string) => readFileSync(resolve(root, file), 'utf8')

describe('orders.tracking_number unique constraint', () => {
  it('schema marks tracking_number unique (nullable — NULLs never conflict)', () => {
    expect(source('lib/db/schema.ts')).toContain(
      "trackingNumber: varchar('tracking_number', { length: 100 }).unique(),",
    )
  })

  it('migration dedups before creating the unique index', () => {
    const sql = source('db/migrate.sql')
    expect(sql).toContain('idx_orders_tracking_number')
    expect(sql).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_tracking_number ON public.orders (tracking_number);',
    )
    // Blank means "no TTN" everywhere in the code — normalize to NULL so
    // duplicate empty strings cannot fail the index creation.
    expect(sql).toContain("TRIM(tracking_number) = ''")
    // Keep the earliest row per tracking number, NULL the rest (a TTN is
    // re-derivable by re-running reconciliation).
    expect(sql).toContain('SELECT MIN(id) FROM orders')
    expect(sql).toContain('SET tracking_number = NULL')
  })
})

describe('isUniqueViolation — the classifier the TTN bind catch relies on', () => {
  it('recognizes a plain pg 23505 error', () => {
    const e = new Error('duplicate key value violates unique constraint "idx_orders_tracking_number"')
    ;(e as unknown as { code: string }).code = '23505'
    expect(isUniqueViolation(e)).toBe(true)
  })

  it('unwraps driver cause chains', () => {
    const inner = new Error('duplicate key')
    ;(inner as unknown as { code: string }).code = '23505'
    expect(isUniqueViolation(new Error('query failed', { cause: inner }))).toBe(true)
  })

  it('rejects non-unique errors', () => {
    expect(isUniqueViolation(new Error('connection failed'))).toBe(false)
    const e = new Error('check violation')
    ;(e as unknown as { code: string }).code = '23514'
    expect(isUniqueViolation(e)).toBe(false)
    expect(isUniqueViolation(null)).toBe(false)
    expect(isUniqueViolation(undefined)).toBe(false)
  })
})
