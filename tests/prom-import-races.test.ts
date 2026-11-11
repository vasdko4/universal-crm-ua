import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  PROM_IMPORT_CATEGORY_LOCK_NS,
  categoryLockKey,
} from '@/lib/prom-import/category-lock'

const root = resolve(import.meta.dirname, '..')
const source = (file: string) => readFileSync(resolve(root, file), 'utf8')
const count = (text: string, needle: string) => text.split(needle).length - 1

describe('categoryLockKey', () => {
  it('is stable per sibling slot and distinct across slots', () => {
    expect(categoryLockKey(null, 'Електроніка')).toBe(categoryLockKey(null, 'Електроніка'))
    expect(categoryLockKey(null, 'Електроніка')).not.toBe(categoryLockKey(5, 'Електроніка'))
    expect(categoryLockKey(5, 'Телефони')).not.toBe(categoryLockKey(5, 'Ноутбуки'))
    expect(categoryLockKey(5, 'Електроніка')).not.toBe(categoryLockKey(null, 'Електроніка'))
  })

  it('uses a namespace distinct from the prom-sync/cron schedulers', () => {
    expect(PROM_IMPORT_CATEGORY_LOCK_NS).not.toBe(20261111)
  })
})

describe('prom-import batch races', () => {
  const src = source('app/actions/prom-import.ts')

  it('final UPDATE subtracts only this worker batch from processing, never blind-wipes it', () => {
    // The old blind wipe is gone...
    expect(src).not.toContain(`'{processing}',\n              '[]'::jsonb,`)
    // ...replaced by array subtraction against the live row.
    expect(src).toContain('removeOwnBatchFromProcessing')
    expect(src).toContain('<> ALL($7::int[])')
    expect(src).toContain('batch.map((b) => b.id)')
    expect(count(src, 'removeOwnBatchFromProcessing')).toBe(4) // 1 definition + 3 uses
  })

  it('completion requires nothing pending AND nothing in flight', () => {
    expect(src).toContain('jsonb_array_length(${removeOwnBatchFromProcessing}) = 0')
  })

  it('category creation is serialized per sibling slot', () => {
    expect(src).toContain('pg_advisory_lock')
    expect(src).toContain('PROM_IMPORT_CATEGORY_LOCK_NS')
    expect(src).toContain('categoryLockKey(parentId, nameUk)')
  })

  it('size merge runs in one transaction with the product row locked', () => {
    const start = src.indexOf('async function mergeSizeIntoProduct')
    const end = src.indexOf('/** Processes the next small batch', start)
    const fn = src.slice(start, end)
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    expect(fn).toContain('await db.transaction(async (tx) => {')
    expect(fn).toContain(".for('update')")
    // The only `db.` use left is the transaction itself; all queries run on tx.
    expect(count(fn, 'await db.')).toBe(1)
    expect(fn).toContain('await tx')
  })
})
