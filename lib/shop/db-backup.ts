/**
 * Nightly PostgreSQL backup → local disk.
 *
 * The dump is a gzipped NDJSON stream: one JSON object per line.
 *   {"_manifest":true,"dumpedAt":"...","retentionDays":10,"tables":[{"name":"orders","rows":12}]}
 *   {"t":"orders","r":{...row...}}
 *
 * Data-only dump (schema lives in db/migrate.sql). The whole dump runs inside
 * a single REPEATABLE READ transaction so the snapshot is consistent.
 * Rows are streamed to disk in bounded batches (10k) through a gzip stream —
 * no table is ever fully buffered in memory (audit A17).
 *
 * Storage: local directory (BACKUP_DIR env, default /app/data/backups).
 * In docker-compose.yml this path is a named volume (techno_store_backups)
 * so dumps survive container recreates. Retention: files older than
 * BACKUP_RETENTION_DAYS (default 10) are deleted, matched by filename date.
 * Restore: scripts/db-restore-backup.mjs <local .jsonl.gz file>.
 */
import { createGzip } from 'node:zlib'
import { mkdir, readdir, rename, unlink } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { join, basename } from 'node:path'
import { once } from 'node:events'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { PoolClient } from 'pg'
import { pool } from '@/lib/db'
import { APP_VERSION } from '@/lib/app-version'
import { reportError } from '@/lib/server-errors'

export const BACKUP_DIR = process.env.BACKUP_DIR || '/app/data/backups'
export const BACKUP_RETENTION_DAYS = 10
/** Safety valve: refuse to dump more rows than this (checked up front). */
const MAX_DUMP_ROWS = 2_000_000
/** Safety valve: abort the dump if the compressed output exceeds this. */
const MAX_DUMP_BYTES = 512 * 1024 * 1024
/** Rows fetched per query while streaming a table. */
const BATCH_SIZE = 10_000

export interface BackupSequence {
  table: string
  column: string
  sequence: string
  lastValue: number
  isCalled: boolean
}

export interface BackupManifest {
  _manifest: true
  dumpedAt: string
  retentionDays: number
  tables: { name: string; rows: number }[]
  /** App version that produced the dump (package.json at build time). */
  appVersion?: string
  /** sha256 of db/migrate.sql that produced the target schema, if known. */
  schemaSha?: string | null
  /** Sequence positions at dump time, for setval on restore. */
  sequences?: BackupSequence[]
}

export interface BackupSummary {
  pathname: string
  tables: number
  rows: number
  bytes: number
  dumpedAt: string
  pruned: number
  pruneErrors: number
}

/** Filenames look like 2026-10-01-003015.jsonl.gz (seconds included so two
 *  runs started in the same minute never share a filename — defense in
 *  depth next to the route-level single-flight lock). */
export function backupFilenameFor(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const stamp = `${date.getUTCFullYear()}-${p(date.getUTCMonth() + 1)}-${p(date.getUTCDate())}-${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}`
  return `${stamp}.jsonl.gz`
}

function parseBackupDate(filename: string): Date | null {
  // Seconds are optional: backups written before 3.4.93 used HHmm.
  const m = basename(filename).match(/(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})?\.jsonl\.gz$/)
  if (!m) return null
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)))
  return Number.isNaN(d.getTime()) ? null : d
}

/** Pure: which backup filenames are older than retentionDays relative to `now`. */
export function backupsToDelete(filenames: string[], now: Date, retentionDays: number): string[] {
  const cutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000
  return filenames.filter((f) => {
    const d = parseBackupDate(f)
    return d !== null && d.getTime() < cutoff
  })
}

async function listBackupFilenames(): Promise<string[]> {
  try {
    const entries = await readdir(BACKUP_DIR)
    return entries.filter((e) => e.endsWith('.jsonl.gz'))
  } catch {
    return []
  }
}

export async function pruneOldBackups(
  now = new Date(),
  retentionDays = BACKUP_RETENTION_DAYS,
): Promise<{ pruned: number; failed: number }> {
  const filenames = await listBackupFilenames()
  const stale = backupsToDelete(filenames, now, retentionDays)
  const results = await Promise.allSettled(stale.map((f) => unlink(join(BACKUP_DIR, f))))
  let pruned = 0
  const failures: { file: string; reason: unknown }[] = []
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      pruned++
    } else {
      failures.push({ file: stale[i], reason: r.reason })
      console.error(`[db-backup] failed to prune ${stale[i]}:`, r.reason)
    }
  })
  if (failures.length > 0) {
    // A persistently failing unlink lets stale files accumulate toward disk
    // exhaustion with no signal — page the admin (audit A19).
    await reportError(
      'cron.db-backup-prune',
      new Error(`Failed to prune ${failures.length} of ${stale.length} stale backups: ${failures.map((f) => f.file).join(', ')}`),
      { alertAdmin: true },
    )
  }
  return { pruned, failed: failures.length }
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

/** Counts compressed bytes passing through; aborts the pipeline past the cap. */
class ByteCounter extends Transform {
  bytes = 0
  constructor(private readonly maxBytes: number) {
    super()
  }
  _transform(chunk: Buffer, _encoding: string, callback: (err?: Error | null) => void): void {
    this.bytes += chunk.length
    if (this.bytes > this.maxBytes) {
      callback(new Error(`Backup aborted: dump exceeds ${MAX_DUMP_BYTES} bytes compressed`))
      return
    }
    this.push(chunk)
    callback()
  }
}

/**
 * Dumps every public table as gzipped NDJSON to the local backup dir,
 * then prunes backups older than the retention window.
 * Runs inside one REPEATABLE READ transaction for a consistent snapshot.
 * The file is written to a .tmp sibling and atomically renamed (audit A20),
 * so a crash mid-write never leaves a truncated backup listed as valid.
 */
export async function runDatabaseBackup(now = new Date()): Promise<BackupSummary> {
  await mkdir(BACKUP_DIR, { recursive: true })

  const filename = backupFilenameFor(now)
  const pathname = join(BACKUP_DIR, filename)
  const tmpPathname = `${pathname}.tmp`

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')

    const { rows: tableRows } = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
    )
    const tables = tableRows.map((r) => r.tablename)

    // Row-cap pre-check (audit A17): COUNT(*) per table inside the same
    // snapshot, before fetching or writing anything.
    const manifestTables: { name: string; rows: number }[] = []
    let totalRows = 0
    for (const table of tables) {
      const { rows } = await client.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM ${quoteIdent(table)}`)
      const count = rows[0]?.c ?? 0
      totalRows += count
      if (totalRows > MAX_DUMP_ROWS) {
        throw new Error(`Backup aborted: dump exceeds ${MAX_DUMP_ROWS.toLocaleString('en-US')} rows`)
      }
      manifestTables.push({ name: table, rows: count })
    }

    // Sequence positions + schema version for the manifest (audit A18).
    // The restorer replays them with setval so a fresh-DB restore can take
    // new rows; old backups without these fields still restore (the
    // restorer falls back to MAX(id)).
    const sequences = await collectSequences(client)
    let schemaSha: string | null = null
    try {
      const { rows } = await client.query<{ migrate_sql_sha256: string }>(
        `SELECT migrate_sql_sha256 FROM public.schema_migrations WHERE id = 1`,
      )
      schemaSha = rows[0]?.migrate_sql_sha256 ?? null
    } catch {
      // Table may not exist yet on a fresh install — not fatal.
      schemaSha = null
    }

    const dumpedAt = now.toISOString()
    const manifest: BackupManifest = {
      _manifest: true,
      dumpedAt,
      retentionDays: BACKUP_RETENTION_DAYS,
      tables: manifestTables,
      appVersion: APP_VERSION,
      schemaSha,
      sequences,
    }

    // Stream: manifest + NDJSON rows → gzip → byte cap → tmp file.
    const fileStream = createWriteStream(tmpPathname)
    const gzip = createGzip({ level: 6 })
    const counter = new ByteCounter(MAX_DUMP_BYTES)
    let streamError: Error | null = null
    const done = pipeline(gzip, counter, fileStream).catch((e: Error) => {
      streamError = e
      throw e
    })
    const writeChunk = async (chunk: string): Promise<void> => {
      if (streamError) throw streamError
      if (!gzip.write(chunk)) {
        await Promise.race([once(gzip, 'drain'), done])
      }
    }

    await writeChunk(`${JSON.stringify(manifest)}\n`)
    for (const table of tables) {
      let offset = 0
      for (;;) {
        if (streamError) throw streamError
        const { rows } = await client.query<Record<string, unknown>>(
          `SELECT * FROM ${quoteIdent(table)} ORDER BY ctid LIMIT $1 OFFSET $2`,
          [BATCH_SIZE, offset],
        )
        if (rows.length === 0) break
        for (const row of rows) {
          await writeChunk(`${JSON.stringify({ t: table, r: row })}\n`)
        }
        offset += rows.length
        if (rows.length < BATCH_SIZE) break
      }
    }
    gzip.end()
    await done

    await client.query('COMMIT')
    await rename(tmpPathname, pathname)

    const { pruned, failed: pruneErrors } = await pruneOldBackups(now, BACKUP_RETENTION_DAYS)
    return { pathname, tables: tables.length, rows: totalRows, bytes: counter.bytes, dumpedAt, pruned, pruneErrors }
  } catch (e) {
    try {
      await client.query('ROLLBACK')
    } catch {
      /* connection already closed */
    }
    try {
      await unlink(tmpPathname)
    } catch {
      /* tmp file was never created */
    }
    throw e
  } finally {
    client.release()
  }
}

/** Serial columns (nextval defaults) with their current sequence positions. */
async function collectSequences(client: PoolClient): Promise<BackupSequence[]> {
  const { rows: cols } = await client.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND column_default LIKE 'nextval(%'
      ORDER BY table_name, column_name`,
  )
  const out: BackupSequence[] = []
  for (const col of cols) {
    const { rows: seqRows } = await client.query<{ seq: string | null }>(
      'SELECT pg_get_serial_sequence($1, $2) AS seq',
      [col.table_name, col.column_name],
    )
    const seq = seqRows[0]?.seq
    if (!seq) continue
    const quoted = seq
      .split('.')
      .map((part) => quoteIdent(part))
      .join('.')
    const { rows: valRows } = await client.query<{ last_value: string; is_called: boolean }>(
      `SELECT last_value, is_called FROM ${quoted}`,
    )
    const val = valRows[0]
    if (!val) continue
    out.push({
      table: col.table_name,
      column: col.column_name,
      sequence: seq,
      lastValue: Number(val.last_value),
      isCalled: val.is_called,
    })
  }
  return out
}
