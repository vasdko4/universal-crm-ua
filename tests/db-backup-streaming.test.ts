import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, readFile, readdir, rm, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { APP_VERSION } from '@/lib/app-version'

// Behavioral tests for the streaming backup writer (audit A17/A18/A19/A20).
// The pool is faked: two tables (t1 with 3 rows incl. a serial id, t2 empty),
// so runDatabaseBackup can execute end-to-end against a temp BACKUP_DIR
// with no real Postgres.
const { mockPool, mockReportError } = vi.hoisted(() => ({
  mockPool: { connect: vi.fn() },
  mockReportError: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ pool: mockPool }))
vi.mock('@/lib/server-errors', () => ({ reportError: mockReportError }))

const tables: Record<string, Record<string, unknown>[]> = {
  t1: [
    { id: 1, name: 'a' },
    { id: 2, name: 'b' },
    { id: 3, name: 'c' },
  ],
  t2: [],
}
let countOverride: Record<string, number> | null = null

function makeClient() {
  // Per-table cursor state for the server-side cursor (audit F1, 3.4.95):
  // DECLARE opens a cursor on a table, FETCH returns the next batch.
  let cursor: { table: string; pos: number } | null = null
  return {
    release: vi.fn(),
    query: vi.fn(async (text: string, params?: unknown[]) => {
      if (/BEGIN|COMMIT|ROLLBACK|SET TRANSACTION/i.test(text)) return { rows: [] }
      if (/FROM pg_tables/.test(text)) {
        return { rows: Object.keys(tables).map((t) => ({ tablename: t })) }
      }
      if (/COUNT\(\*\)/.test(text)) {
        const t = text.match(/FROM "([^"]+)"/)?.[1] ?? ''
        const c = countOverride?.[t] ?? tables[t]?.length ?? 0
        return { rows: [{ c }] }
      }
      if (/information_schema\.columns/.test(text)) {
        return { rows: [{ table_name: 't1', column_name: 'id' }] }
      }
      if (/pg_get_serial_sequence\(\$1, \$2\)/.test(text)) {
        return { rows: [{ seq: 'public.t1_id_seq' }] }
      }
      if (/last_value/.test(text)) return { rows: [{ last_value: '3', is_called: true }] }
      if (/schema_migrations/.test(text)) return { rows: [{ migrate_sql_sha256: 'abc123' }] }
      if (/^DECLARE \w+ CURSOR FOR SELECT \* FROM "([^"]+)" ORDER BY ctid/i.test(text)) {
        cursor = { table: text.match(/FROM "([^"]+)"/)?.[1] ?? '', pos: 0 }
        return { rows: [] }
      }
      if (/^FETCH (\d+) FROM \w+/i.test(text)) {
        const n = Number(text.match(/^FETCH (\d+)/i)?.[1] ?? 0)
        const t = cursor?.table ?? ''
        const pos = cursor?.pos ?? 0
        const rows = (tables[t] ?? []).slice(pos, pos + n)
        if (cursor) cursor.pos += rows.length
        return { rows }
      }
      if (/^CLOSE \w+/i.test(text)) {
        cursor = null
        return { rows: [] }
      }
      return { rows: [] }
    }),
  }
}

let dir = ''
async function loadBackupModule() {
  dir = await mkdtemp(join(tmpdir(), 'db-backup-test-'))
  process.env.BACKUP_DIR = dir
  vi.resetModules()
  return import('@/lib/shop/db-backup')
}

afterEach(async () => {
  countOverride = null
  mockReportError.mockClear()
  if (dir) await rm(dir, { recursive: true, force: true })
  dir = ''
})

describe('runDatabaseBackup streams a format-identical dump (A17/A18/A20)', () => {
  it('writes manifest + NDJSON rows to .jsonl.gz, no .tmp left behind', async () => {
    mockPool.connect.mockImplementation(async () => makeClient())
    const mod = await loadBackupModule()
    const summary = await mod.runDatabaseBackup(new Date(Date.UTC(2026, 9, 1, 0, 30, 5)))

    expect(summary.tables).toBe(2)
    expect(summary.rows).toBe(3)
    expect(summary.bytes).toBeGreaterThan(0)
    expect(summary.pruned).toBe(0)
    expect(summary.pruneErrors).toBe(0)
    expect(summary.pathname).toBe(join(dir, '2026-10-01-003005.jsonl.gz'))

    const entries = await readdir(dir)
    expect(entries).toEqual(['2026-10-01-003005.jsonl.gz'])

    const text = gunzipSync(await readFile(summary.pathname)).toString('utf8')
    const lines = text.split('\n').filter((l) => l.length > 0)
    const manifest = JSON.parse(lines[0])
    expect(manifest._manifest).toBe(true)
    expect(manifest.dumpedAt).toBe('2026-10-01T00:30:05.000Z')
    expect(manifest.retentionDays).toBe(10)
    expect(manifest.tables).toEqual([
      { name: 't1', rows: 3 },
      { name: 't2', rows: 0 },
    ])
    expect(manifest.appVersion).toBe(APP_VERSION)
    expect(manifest.schemaSha).toBe('abc123')
    expect(manifest.sequences).toEqual([
      { table: 't1', column: 'id', sequence: 'public.t1_id_seq', lastValue: 3, isCalled: true },
    ])
    expect(lines.slice(1).map((l) => JSON.parse(l))).toEqual([
      { t: 't1', r: { id: 1, name: 'a' } },
      { t: 't1', r: { id: 2, name: 'b' } },
      { t: 't1', r: { id: 3, name: 'c' } },
    ])
  })

  it('refuses to dump when the row cap is exceeded — pre-check, nothing written', async () => {
    mockPool.connect.mockImplementation(async () => makeClient())
    countOverride = { t1: 2_000_001 }
    const mod = await loadBackupModule()
    await expect(mod.runDatabaseBackup(new Date(Date.UTC(2026, 9, 1, 0, 30, 5)))).rejects.toThrow(
      /exceeds 2,000,000 rows/,
    )
    expect(await readdir(dir)).toEqual([])
  })
})

describe('pruneOldBackups counts only successful deletions (A19)', () => {
  beforeEach(() => {
    mockPool.connect.mockImplementation(async () => makeClient())
  })

  it('returns { pruned, failed } and alerts when an unlink fails', async () => {
    const mod = await loadBackupModule()
    // One stale file (deletable) + one stale directory named *.jsonl.gz
    // (unlink fails with EISDIR) — exercises the failure path for real.
    await writeFile(join(dir, '2026-10-01-003000.jsonl.gz'), 'x')
    await mkdir(join(dir, '2026-09-30-003000.jsonl.gz'))
    const result = await mod.pruneOldBackups(new Date(Date.UTC(2026, 9, 11, 12, 0)))
    expect(result).toEqual({ pruned: 1, failed: 1 })
    expect(mockReportError).toHaveBeenCalledTimes(1)
    expect(mockReportError.mock.calls[0][0]).toBe('cron.db-backup-prune')
    expect(mockReportError.mock.calls[0][2]).toEqual({ alertAdmin: true })
    expect(await readdir(dir)).toEqual(['2026-09-30-003000.jsonl.gz'])
  })

  it('returns { pruned: 0, failed: 0 } and stays silent when nothing is stale', async () => {
    const mod = await loadBackupModule()
    const result = await mod.pruneOldBackups(new Date(Date.UTC(2026, 9, 11, 12, 0)))
    expect(result).toEqual({ pruned: 0, failed: 0 })
    expect(mockReportError).not.toHaveBeenCalled()
  })
})
