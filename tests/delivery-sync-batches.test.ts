import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const source = (file: string) => readFileSync(resolve(root, file), 'utf8')

describe('delivery sync survives a failed NP batch', () => {
  const src = source('lib/delivery/sync-tracking.ts')

  it('wraps the batch track call in try/catch and records the failure', () => {
    const trackCommentAt = src.indexOf('// 3) Batch-track')
    const tryAt = src.indexOf('try {', trackCommentAt)
    const callAt = src.indexOf('await trackDocuments(', tryAt)
    const catchAt = src.indexOf('} catch (e) {', callAt)
    expect(trackCommentAt).toBeGreaterThan(-1)
    expect(tryAt).toBeGreaterThan(trackCommentAt)
    expect(callAt).toBeGreaterThan(tryAt)
    expect(catchAt).toBeGreaterThan(callAt)
    expect(src.slice(catchAt, catchAt + 400)).toContain('result.errors.push')
  })

  it('continues with the next page: statuses are built from the (possibly empty) list', () => {
    const catchAt = src.indexOf('} catch (e) {', src.indexOf('await trackDocuments('))
    const byTtnAt = src.indexOf('const byTtn = new Map(statuses.map', catchAt)
    expect(byTtnAt).toBeGreaterThan(catchAt)
    // Cursor still advances after a failed page.
    const cursorAt = src.indexOf('cursorId = Number(rows[rows.length - 1].id)', byTtnAt)
    expect(cursorAt).toBeGreaterThan(byTtnAt)
  })

  it('keeps the per-order guard for individual failures', () => {
    expect(src).toContain("result.errors.push(`Заказ №${row.order_number}: ${(e as Error).message}`)")
  })
})
