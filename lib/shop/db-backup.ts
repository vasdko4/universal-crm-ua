/**
 * Nightly PostgreSQL backup → local disk.
 *
 * The dump is a gzipped NDJSON stream: one JSON object per line.
 *   {"_manifest":true,"dumpedAt":"...","retentionDays":10,"tables":[{"name":"orders","rows":12}]}
 *   {"t":"orders","r":{...row...}}
 *
 * Data-only dump (schema lives in db/migrate.sql). The whole dump runs inside
 * a single REPEATABLE READ transaction so the snapshot is consistent.
 *
 * Storage: local directory (BACKUP_DIR env, default /app/data/backups).
 * In docker-compose.yml this path is a named volume (techno_store_backups)
 * so dumps survive container recreates. Retention: files older than
 * BACKUP_RETENTION_DAYS (default 10) are deleted, matched by filename date.
 */
import { gzipSync } from 'node:zlib'
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises'
import { join, basename } from 'node:path'
import { pool } from '@/lib/db'

export const BACKUP_DIR = process.env.BACKUP_DIR || '/app/data/backups'
export const BACKUP_RETENTION_DAYS = 10
/** Safety valve: refuse to buffer more rows than this into one dump. */
const MAX_DUMP_ROWS = 2_000_000

export interface BackupManifest {
  _manifest: true
  dumpedAt: string
  retentionDays: number
  tables: { name: string; rows: number }[]
}

export interface BackupSummary {
  pathname: string
  tables: number
  rows: number
  bytes: number
  dumpedAt: string
  pruned: number
}

/** Filenames look like 2026-10-01-0030.jsonl.gz */
export function backupFilenameFor(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const stamp = `${date.getUTCFullYear()}-${p(date.getUTCMonth() + 1)}-${p(date.getUTCDate())}-${p(date.getUTCHours())}${p(date.getUTCMinutes())}`
  return `${stamp}.jsonl.gz`
}

function parseBackupDate(filename: string): Date | null {
  const m = basename(filename).match(/(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})\.jsonl\.gz$/)
  if (!m) return null
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]))
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

export async function pruneOldBackups(now = new Date(), retentionDays = BACKUP_RETENTION_DAYS): Promise<number> {
  const filenames = await listBackupFilenames()
  const stale = backupsToDelete(filenames, now, retentionDays)
  await Promise.all(stale.map((f) => unlink(join(BACKUP_DIR, f)).catch(() => {})))
  return stale.length
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

/**
 * Dumps every public table as gzipped NDJSON to the local backup dir,
 * then prunes backups older than the retention window.
 * Runs inside one REPEATABLE READ transaction for a consistent snapshot.
 */
export async function runDatabaseBackup(now = new Date()): Promise<BackupSummary> {
  await mkdir(BACKUP_DIR, { recursive: true })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')

    const { rows: tableRows } = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
    )
    const tables = tableRows.map((r) => r.tablename)

    const lines: string[] = []
    const manifestTables: { name: string; rows: number }[] = []
    let totalRows = 0

    for (const table of tables) {
      const { rows } = await client.query<Record<string, unknown>>(`SELECT * FROM ${quoteIdent(table)}`)
      totalRows += rows.length
      if (totalRows > MAX_DUMP_ROWS) {
        throw new Error(`Backup aborted: dump exceeds ${MAX_DUMP_ROWS.toLocaleString('en-US')} rows`)
      }
      manifestTables.push({ name: table, rows: rows.length })
      for (const row of rows) lines.push(JSON.stringify({ t: table, r: row }))
    }
    await client.query('COMMIT')

    const dumpedAt = now.toISOString()
    const manifest: BackupManifest = { _manifest: true, dumpedAt, retentionDays: BACKUP_RETENTION_DAYS, tables: manifestTables }
    const body = gzipSync(JSON.stringify(manifest) + '\n' + lines.map((l) => l + '\n').join(''), { level: 6 })

    const filename = backupFilenameFor(now)
    const pathname = join(BACKUP_DIR, filename)
    await writeFile(pathname, body)

    const pruned = await pruneOldBackups(now, BACKUP_RETENTION_DAYS)
    return { pathname, tables: tables.length, rows: totalRows, bytes: body.length, dumpedAt, pruned }
  } catch (e) {
    try {
      await client.query('ROLLBACK')
    } catch {
      /* connection already closed */
    }
    throw e
  } finally {
    client.release()
  }
}
