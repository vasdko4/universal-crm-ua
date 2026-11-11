#!/usr/bin/env node
/**
 * Restores a nightly backup produced by the /api/cron/db-backup endpoint
 * (gzipped NDJSON in Vercel Blob under db-backups/, or a local .jsonl.gz file).
 *
 * The dump is DATA ONLY — the schema must already exist (db/migrate.sql).
 * Strategy: TRUNCATE every dumped table (CASCADE), then re-INSERT rows with
 * parameterized queries inside one transaction. The dump is streamed
 * through gunzip line by line (never fully buffered) — at most one bounded
 * INSERT chunk is held in memory at a time.
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
import { createReadStream } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { Readable } from 'node:stream'
import { StringDecoder } from 'node:string_decoder'
import { createGunzip } from 'node:zlib'

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
  // Audit F1 (3.4.96): '--latest' must pass this guard — the old guard
  // threw for it (`arg === '--latest' || ...`) before the listing branch
  // below could ever run. Note the trap: just deleting that disjunct is
  // not enough, '--latest' matches neither '.jsonl.gz' nor '/' either, so
  // the guard has to exempt it explicitly.
  if (arg !== '--latest' && !arg.endsWith('.jsonl.gz') && !arg.includes('/')) {
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
    return {
      label: pathname,
      // Audit F2 (3.4.96): a fresh stream per open, never the whole file —
      // the caller streams it through gunzip instead of buffering it.
      openStream: async () => {
        console.log(`Downloading ${pathname} …`)
        const res = await fetch(blob.url, { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) throw new Error(`Blob download failed: HTTP ${res.status}`)
        return Readable.fromWeb(res.body)
      },
    }
  }
  // Refuse to read outside the working directory (path traversal via CLI arg).
  const resolved = resolve(arg)
  const cwd = resolve('.')
  if (resolved !== cwd && !resolved.startsWith(cwd + sep)) {
    throw new Error(`Refusing to read file outside the working directory: ${arg}`)
  }
  return {
    label: arg,
    openStream: () => {
      console.log(`Reading local file ${arg} …`)
      return createReadStream(resolved)
    },
  }
}

// Audit F2 (3.4.96): split a stream into lines incrementally — the previous
// gunzipSync + split + byTable Map held ~4-6x the decompressed dump size in
// heap at once. StringDecoder keeps multi-byte UTF-8 intact across chunk
// boundaries; empty lines are skipped like before.
async function* linesOf(stream) {
  const decoder = new StringDecoder('utf8')
  let buf = ''
  for await (const chunk of stream) {
    buf += decoder.write(chunk)
    let idx
    while ((idx = buf.indexOf('\n')) !== -1) {
      const raw = buf.slice(0, idx)
      buf = buf.slice(idx + 1)
      const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw
      if (line.trim().length > 0) yield line
    }
  }
  buf += decoder.end()
  const tail = buf.endsWith('\r') ? buf.slice(0, -1) : buf
  if (tail.trim().length > 0) yield tail
}

function gunzippedLines(inputStream) {
  const gunzip = createGunzip()
  // pipe() does not forward source errors — without this a read failure
  // would hang the line iterator instead of failing the restore.
  inputStream.on('error', (e) => gunzip.destroy(e))
  inputStream.pipe(gunzip)
  return linesOf(gunzip)
}

function quoteIdent(name) {
  return `"${name.replace(/"/g, '""')}"`
}

const { label, openStream } = await loadBackup()

// Audit F2 (3.4.96): the dump is streamed line by line through gunzip —
// never gunzipSync'd, never split into a lines array, never grouped into a
// byTable Map. At most one bounded INSERT chunk is buffered at a time.
const lines = gunzippedLines(await openStream())
const first = await lines.next()
if (first.done) throw new Error('Backup file is empty')
const manifest = JSON.parse(first.value)
if (!manifest._manifest) throw new Error('First line is not a backup manifest — wrong file?')
const manifestTables = Array.isArray(manifest.tables) ? manifest.tables : []
console.log(`Backup ${label}: dumpedAt=${manifest.dumpedAt}, tables=${manifestTables.length}`)

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

  // Audit F2 (3.4.96): the TRUNCATE list comes from the manifest, not from
  // observed rows — a table with zero rows in the dump must still be
  // truncated (before this fix it silently survived the restore). The
  // manifest has carried {name, rows} per table since the backup format was
  // introduced; a manifest without a table list (older than any known dump)
  // falls back to a pre-scan of the stream for table names — TRUNCATE ...
  // CASCADE has to run before ANY insert, so the names must be known up
  // front and a lazy per-table TRUNCATE would risk cascade-wiping rows
  // inserted for an earlier table.
  let tableNames = manifestTables.map((t) => t?.name).filter((n) => typeof n === 'string' && n.length > 0)
  let rowLines = lines
  if (tableNames.length === 0) {
    const seen = new Set()
    for await (const line of lines) {
      const { t } = JSON.parse(line)
      if (typeof t === 'string' && t) seen.add(t)
    }
    tableNames = [...seen]
    rowLines = gunzippedLines(await openStream())
    const again = await rowLines.next() // skip the manifest line on the second pass
    if (again.done) throw new Error('Backup file is empty')
  }
  const truncated = new Set(tableNames)
  if (tableNames.length > 0) {
    console.log(`TRUNCATE ${tableNames.length} tables (CASCADE) …`)
    await client.query(`TRUNCATE ${tableNames.map(quoteIdent).join(', ')} CASCADE`)
  }

  // Stream rows: accumulate one bounded chunk per table and INSERT inside
  // the same single transaction; flush when the chunk is full, on table
  // change, or at end of stream. Rows for a table are contiguous in the
  // dump (the producer writes table by table), so at most one chunk is
  // ever buffered. Chunk size keeps the same 65k parameter bound as before.
  let total = 0
  const tableMeta = new Map() // name -> { cols, hasId, count }
  let currentTable = null
  let pending = []
  async function flushPending() {
    if (pending.length === 0) return
    const meta = tableMeta.get(currentTable)
    const cols = meta.cols
    const colList = cols.map(quoteIdent).join(', ')
    const values = []
    const placeholders = pending.map((row, ri) => {
      const rowValues = cols.map((c) => revive(row[c]))
      values.push(...rowValues)
      const base = ri * cols.length
      return `(${cols.map((_, ci) => `$${base + ci + 1}`).join(', ')})`
    })
    await client.query(`INSERT INTO ${quoteIdent(currentTable)} (${colList}) VALUES ${placeholders.join(', ')}`, values)
    meta.count += pending.length
    total += pending.length
    pending = []
  }
  function logTable(name) {
    const meta = tableMeta.get(name)
    if (meta && meta.count > 0) console.log(`  ${name}: ${meta.count} rows`)
  }
  for await (const line of rowLines) {
    const { t, r } = JSON.parse(line)
    if (t !== currentTable) {
      await flushPending()
      if (currentTable !== null) logTable(currentTable)
      currentTable = t
      if (!tableMeta.has(t)) {
        tableMeta.set(t, { cols: Object.keys(r), hasId: Object.prototype.hasOwnProperty.call(r, 'id'), count: 0 })
      }
    }
    const meta = tableMeta.get(t)
    if (!meta.hasId && Object.prototype.hasOwnProperty.call(r, 'id')) meta.hasId = true
    pending.push(r)
    const chunkSize = Math.max(1, Math.floor(60000 / meta.cols.length))
    if (pending.length >= chunkSize) await flushPending()
  }
  await flushPending()
  if (currentTable !== null) logTable(currentTable)
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
  for (const table of truncated) {
    const recorded = seqByTable.get(table) ?? []
    if (recorded.length > 0) {
      for (const s of recorded) {
        await client.query('SELECT setval($1::regclass, $2, $3)', [s.sequence, s.lastValue, s.isCalled === true])
        console.log(`  ${table}.${s.column ?? 'id'}: sequence ${s.sequence} → ${s.lastValue} (called=${s.isCalled === true})`)
      }
      continue
    }
    // No recorded positions: only the legacy MAX(id) fallback remains, and
    // it needs to know whether the table has an `id` column — captured
    // from the first streamed row instead of a buffered rows[0].
    const meta = tableMeta.get(table)
    if (!meta || !meta.hasId) continue
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
  console.log(`✓ Restored ${total} rows into ${truncated.size} tables from ${label}`)
} catch (e) {
  await client.query('ROLLBACK')
  console.error('✗ Restore failed, rolled back:', e.message)
  process.exit(1)
} finally {
  client.release()
  await pool.end()
}
