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

const byTable = new Map()
for (let i = 1; i < lines.length; i++) {
  const { t, r } = JSON.parse(lines[i])
  if (!byTable.has(t)) byTable.set(t, [])
  byTable.get(t).push(r)
}

const pool = new Pool({ connectionString })
const client = await pool.connect()
try {
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
