/**
 * Nightly PostgreSQL backup (Vercel Cron, no GitHub involved).
 *
 * The dump is a gzipped NDJSON stream: one JSON object per line.
 *   {"_manifest":true,"dumpedAt":"...","retentionDays":10,"tables":[{"name":"orders","rows":12}]}
 *   {"t":"orders","r":{...row...}}
 *
 * Data-only dump (schema lives in db/migrate.sql). The whole dump runs inside
 * a single REPEATABLE READ transaction so the snapshot is consistent.
 * Restore: scripts/db-restore.mjs (TRUNCATE + parameterized INSERTs).
 *
 * Retention: backups older than BACKUP_RETENTION_DAYS (default 10) are
 * deleted from Vercel Blob, matched by backup filename date.
 */
import { gzipSync } from 'node:zlib'
import { put, del, list } from '@vercel/blob'
import { pool } from '@/lib/db'

export const BACKUP_BLOB_PREFIX = 'db-backups/'
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
  blobPathname: string
  tables: number
  rows: number
  bytes: number
  dumpedAt: string
  pruned: number
}

/** Filenames look like db-backups/2026-10-01-0030.jsonl.gz */
export function backupPathFor(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const stamp = `${date.getUTCFullYear()}-${p(date.getUTCMonth() + 1)}-${p(date.getUTCDate())}-${p(date.getUTCHours())}${p(date.getUTCMinutes())}`
  return `${BACKUP_BLOB_PREFIX}${stamp}.jsonl.gz`
}

function parseBackupDate(pathname: string): Date | null {
  const m = pathname.match(/(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})\.jsonl\.gz$/)
  if (!m) return null
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]))
  return Number.isNaN(d.getTime()) ? null : d
}

/** Pure: which backup pathnames are older than retentionDays relative to `now`. */
export function backupsToDelete(pathnames: string[], now: Date, retentionDays: number): string[] {
  const cutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000
  return pathnames.filter((p) => {
    const d = parseBackupDate(p)
    return d !== null && d.getTime() < cutoff
  })
}

async function listBackupPathnames(): Promise<string[]> {
  const pathnames: string[] = []
  let cursor: string | undefined
  do {
    const page = await list({ prefix: BACKUP_BLOB_PREFIX, cursor })
    for (const b of page.blobs) pathnames.push(b.pathname)
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)
  return pathnames
}

export async function pruneOldBackups(now = new Date(), retentionDays = BACKUP_RETENTION_DAYS): Promise<number> {
  const pathnames = await listBackupPathnames()
  const stale = backupsToDelete(pathnames, now, retentionDays)
  await Promise.all(stale.map((pathname) => del(pathname)))
  return stale.length
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

/**
 * Dumps every public table as gzipped NDJSON into Vercel Blob (private),
 * then prunes backups older than the retention window.
 * Runs inside one REPEATABLE READ transaction for a consistent snapshot.
 */
export async function runDatabaseBackup(now = new Date()): Promise<BackupSummary> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not configured')

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

    const pathname = backupPathFor(now)
    await put(pathname, body, {
      access: 'private',
      contentType: 'application/gzip',
      addRandomSuffix: false,
      token,
    })

    const pruned = await pruneOldBackups(now, BACKUP_RETENTION_DAYS)
    return { blobPathname: pathname, tables: tables.length, rows: totalRows, bytes: body.length, dumpedAt, pruned }
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
