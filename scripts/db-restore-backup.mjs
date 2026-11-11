#!/usr/bin/env node
/**
 * Restores a nightly backup produced by the /api/cron/db-backup endpoint
 * (gzipped NDJSON in Vercel Blob under db-backups/, or a local .jsonl.gz file).
 *
 * The dump is DATA ONLY — the schema must already exist (db/migrate.sql).
 * Strategy: TRUNCATE every dumped table (CASCADE), then re-INSERT rows with
 * parameterized queries inside one transaction.
 *
 * Usage:
 *   node --env-file=.env.local scripts/db-restore-backup.mjs db-backups/2026-10-01-0030.jsonl.gz
 *   node --env-file=.env.local scripts/db-restore-backup.mjs ./backup.jsonl.gz
 *   node --env-file=.env.local scripts/db-restore-backup.mjs --latest   # newest backup in Blob
 *
 * Env: DATABASE_URL, BLOB_READ_WRITE_TOKEN (only for Blob sources).
 * DANGER: this wipes current data in the target database. Double-check DATABASE_URL.
 */
import { Pool } from 'pg'
import { list } from '@vercel/blob'
import { readFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { gunzipSync } from 'node:zlib'

const BACKUP_PREFIX = 'db-backups/'

const arg = process.argv[2]
if (!arg) {
  console.error('Usage: node --env-file=.env.local scripts/db-restore-backup.mjs <blob-pathname | local-file | --latest>')
  process.exit(1)
}

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('✗ DATABASE_URL is not set.')
  process.exit(1)
}

function revive(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (value.type === 'Buffer' && Array.isArray(value.data)) return Buffer.from(value.data)
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = revive(v)
    return out
  }
  if (Array.isArray(value)) return value.map(revive)
  return value
}

async function loadBackup() {
  if (arg === '--latest' || (!arg.endsWith('.jsonl.gz') && !arg.includes('/'))) {
    throw new Error('Blob download by prefix listing is only supported with an exact pathname or --latest')
  }
  if (arg.startsWith(BACKUP_PREFIX) || arg === '--latest') {
    const token = process.env.BLOB_READ_WRITE_TOKEN
    if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not set')
    let pathname = arg
    if (arg === '--latest') {
      const page = await list({ prefix: BACKUP_PREFIX, token })
      const names = page.blobs.map((b) => b.pathname).sort()
      if (!names.length) throw new Error('No backups found in Blob')
      pathname = names[names.length - 1]
    }
    const page = await list({ prefix: pathname, token })
    const blob = page.blobs.find((b) => b.pathname === pathname)
    if (!blob) throw new Error(`Backup not found in Blob: ${pathname}`)
    console.log(`Downloading ${pathname} …`)
    const res = await fetch(blob.url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error(`Blob download failed: HTTP ${res.status}`)
    return { label: pathname, bytes: Buffer.from(await res.arrayBuffer()) }
  }
  console.log(`Reading local file ${arg} …`)
  // Refuse to read outside the working directory (path traversal via CLI arg).
  const resolved = resolve(arg)
  const cwd = resolve('.')
  if (resolved !== cwd && !resolved.startsWith(cwd + sep)) {
    throw new Error(`Refusing to read file outside the working directory: ${arg}`)
  }
  return { label: arg, bytes: await readFile(resolved) }
}

function quoteIdent(name) {
  return `"${name.replace(/"/g, '""')}"`
}

const { label, bytes } = await loadBackup()
const text = gunzipSync(bytes).toString('utf8')
const lines = text.split('\n').filter((l) => l.trim().length > 0)
const manifest = JSON.parse(lines[0])
if (!manifest._manifest) throw new Error('First line is not a backup manifest — wrong file?')
console.log(`Backup ${label}: dumpedAt=${manifest.dumpedAt}, tables=${manifest.tables.length}`)

// Audit A18: the dump records the producing app version + schema sha in the
// manifest. A mismatch does not block the restore (restoring yesterday's
// backup after today's deploy is a legitimate disaster-recovery flow),
// but it warns loudly — schema drift is the main restore-time surprise.
let appVersion = null
try {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  appVersion = pkg.version ?? null
} catch {
  /* version check skipped */
}
if (appVersion && manifest.appVersion && manifest.appVersion !== appVersion) {
  console.error(
    `\n⚠ WARNING: backup was made by app version ${manifest.appVersion}, this checkout is ${appVersion}. ` +
      'The schema may have changed since the dump — apply db/migrate.sql first (Admin → Updates → «Перевірити версію БД»).\n',
  )
}

const byTable = new Map()
for (let i = 1; i < lines.length; i++) {
  const { t, r } = JSON.parse(lines[i])
  if (!byTable.has(t)) byTable.set(t, [])
  byTable.get(t).push(r)
}

const pool = new Pool({ connectionString })
const client = await pool.connect()
try {
  // Audit A18: compare the dump's schema sha against the target DB.
  if (manifest.schemaSha) {
    try {
      const { rows } = await client.query(
        'SELECT migrate_sql_sha256 FROM public.schema_migrations WHERE id = 1',
      )
      const current = rows[0]?.migrate_sql_sha256
      if (current && current !== manifest.schemaSha) {
        console.error(
          `\n⚠ WARNING: backup schema sha ${manifest.schemaSha} != target DB schema sha ${current}. ` +
            'Apply db/migrate.sql first if the restore fails or behaves oddly.\n',
        )
      }
    } catch {
      // schema_migrations missing — schema not applied yet; the doc already
      // says to apply db/migrate.sql first.
    }
  }
  await client.query('BEGIN')
  const tables = [...byTable.keys()]
  console.log(`TRUNCATE ${tables.length} tables (CASCADE) …`)
  await client.query(`TRUNCATE ${tables.map(quoteIdent).join(', ')} CASCADE`)

  let total = 0
  for (const table of tables) {
    const rows = byTable.get(table)
    if (!rows.length) continue
    const cols = Object.keys(rows[0])
    const colList = cols.map(quoteIdent).join(', ')
    // Insert in chunks to stay under the 65k parameter limit.
    const chunkSize = Math.max(1, Math.floor(60000 / cols.length))
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize)
      const values = []
      const placeholders = chunk.map((row, ri) => {
        const rowValues = cols.map((c) => revive(row[c]))
        values.push(...rowValues)
        const base = ri * cols.length
        return `(${cols.map((_, ci) => `$${base + ci + 1}`).join(', ')})`
      })
      await client.query(`INSERT INTO ${quoteIdent(table)} (${colList}) VALUES ${placeholders.join(', ')}`, values)
    }
    total += rows.length
    console.log(`  ${table}: ${rows.length} rows`)
  }
  // Audit A18: sequences. TRUNCATE without RESTART IDENTITY does not reset
  // them, and a fresh DB starts at 1 — but the re-INSERTed rows carry
  // explicit ids, so the first new auto-id INSERT would fail with a
  // duplicate key. Replay the positions recorded in the manifest; old
  // manifests without `sequences` fall back to MAX(id) per table.
  const manifestSequences = Array.isArray(manifest.sequences) ? manifest.sequences : []
  const seqByTable = new Map()
  for (const s of manifestSequences) {
    if (typeof s?.table !== 'string' || typeof s?.sequence !== 'string' || !s.sequence) continue
    if (typeof s?.lastValue !== 'number' || !Number.isFinite(s.lastValue)) continue
    if (!seqByTable.has(s.table)) seqByTable.set(s.table, [])
    seqByTable.get(s.table).push(s)
  }
  for (const table of tables) {
    const recorded = seqByTable.get(table) ?? []
    if (recorded.length > 0) {
      for (const s of recorded) {
        await client.query('SELECT setval($1::regclass, $2, $3)', [s.sequence, s.lastValue, s.isCalled === true])
        console.log(`  ${table}.${s.column ?? 'id'}: sequence ${s.sequence} → ${s.lastValue} (called=${s.isCalled === true})`)
      }
      continue
    }
    const rows = byTable.get(table)
    if (!rows.length || !Object.prototype.hasOwnProperty.call(rows[0], 'id')) continue
    const { rows: seqRows } = await client.query('SELECT pg_get_serial_sequence($1, $2) AS seq', [table, 'id'])
    const seq = seqRows[0]?.seq
    if (!seq) continue
    await client.query(
      `SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE(MAX("id"), 1), MAX("id") IS NOT NULL) FROM ${quoteIdent(table)}`,
      [table],
    )
    console.log(`  ${table}.id: sequence ${seq} → MAX(id) (legacy manifest, no recorded positions)`)
  }
  await client.query('COMMIT')
  console.log(`✓ Restored ${total} rows into ${tables.length} tables from ${label}`)
} catch (e) {
  await client.query('ROLLBACK')
  console.error('✗ Restore failed, rolled back:', e.message)
  process.exit(1)
} finally {
  client.release()
  await pool.end()
}
