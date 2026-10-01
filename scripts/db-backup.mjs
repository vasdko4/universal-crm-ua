#!/usr/bin/env node
// Daily production database backup helper.
//
// The GitHub workflow (.github/workflows/db-backup.yml) runs pg_dump first,
// then calls this script with the dump file path. The script uploads the
// dump to Vercel Blob under `db-backups/YYYY-MM-DD-HHmm.dump` (timestamp in
// Europe/Kyiv) and deletes every backup older than the retention window.
//
// Pure helpers (formatKyivTimestamp, parseBackupTimestamp, backupAgeMs,
// isBackupExpired, selectExpiredBackups) are exported so tests can cover the
// date parsing and retention boundaries without touching the network.

import { put, list, del } from '@vercel/blob'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const BACKUP_PREFIX = 'db-backups/'
export const BACKUP_TIMEZONE = 'Europe/Kyiv'
// Dumps strictly older than this are deleted; a dump that is exactly
// RETENTION_DAYS old is kept.
export const RETENTION_DAYS = 10
export const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000

const NAME_RE = /^(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})\.dump$/

const pad2 = (n) => String(n).padStart(2, '0')

function partsOf(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  return Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]))
}

// UTC offset (ms) of the given timezone at the given instant. Europe/Kyiv is
// UTC+2 in winter and UTC+3 in summer (DST), so the offset is derived from
// the actual instant instead of being hardcoded.
function tzOffsetMs(date, timeZone) {
  const p = partsOf(date, timeZone)
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  return asUtc - date.getTime()
}

// Format a Date as "YYYY-MM-DD-HHmm" in Europe/Kyiv.
export function formatKyivTimestamp(date = new Date()) {
  const p = partsOf(date, BACKUP_TIMEZONE)
  return `${p.year}-${p.month}-${p.day}-${p.hour}${p.minute}`
}

// Build the blob object name for a backup taken at `date`.
export function buildObjectName(date = new Date()) {
  return `${BACKUP_PREFIX}${formatKyivTimestamp(date)}.dump`
}

// Parse the Kyiv-local timestamp embedded in a backup file name
// (bare name or full "db-backups/..." path). Returns a Date, or null when
// the name does not match the expected pattern or is not a real calendar date.
export function parseBackupTimestamp(fileName) {
  const base = path.posix.basename(fileName)
  const m = NAME_RE.exec(base)
  if (!m) return null
  const [year, month, day, hour, minute] = m.slice(1).map(Number)
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null

  // Convert the Kyiv wall-clock time to an instant. The offset depends on the
  // instant itself (DST), so resolve it iteratively for exactness.
  let utcMs = Date.UTC(year, month - 1, day, hour, minute) - tzOffsetMs(new Date(Date.UTC(year, month - 1, day, hour, minute)), BACKUP_TIMEZONE)
  const corrected = Date.UTC(year, month - 1, day, hour, minute) - tzOffsetMs(new Date(utcMs), BACKUP_TIMEZONE)
  if (corrected !== utcMs) utcMs = corrected

  const parsed = new Date(utcMs)
  // Reject rolled-over dates such as 2026-02-30 by requiring a round trip.
  if (formatKyivTimestamp(parsed) !== `${year}-${pad2(month)}-${pad2(day)}-${pad2(hour)}${pad2(minute)}`) return null
  return parsed
}

// Age of a backup in milliseconds, or null when the file name is not a
// recognized backup name. Future-dated names yield a negative age.
export function backupAgeMs(fileName, nowMs = Date.now()) {
  const parsed = parseBackupTimestamp(fileName)
  return parsed === null ? null : nowMs - parsed.getTime()
}

// A backup expires when it is STRICTLY older than the retention window.
// Unrecognized file names never expire (safer to keep unknown objects).
export function isBackupExpired(fileName, { nowMs = Date.now(), retentionDays = RETENTION_DAYS } = {}) {
  const age = backupAgeMs(fileName, nowMs)
  if (age === null) return false
  return age > retentionDays * 24 * 60 * 60 * 1000
}

// Pick the blob pathnames that must be deleted from a listing.
export function selectExpiredBackups(pathnames, opts = {}) {
  return pathnames.filter(
    (name) => name.startsWith(BACKUP_PREFIX) && isBackupExpired(name, opts),
  )
}

async function listAllBlobs(token, prefix) {
  const blobs = []
  let cursor
  do {
    const res = await list({ token, prefix, cursor, limit: 1000 })
    blobs.push(...res.blobs)
    cursor = res.hasMore ? res.cursor : undefined
  } while (cursor)
  return blobs
}

async function uploadBackup(dumpPath, token) {
  const objectName = buildObjectName()
  const data = await readFile(dumpPath)
  const blob = await put(objectName, data, {
    access: 'public',
    token,
    contentType: 'application/octet-stream',
    addRandomSuffix: false,
  })
  console.log(`Uploaded backup as ${objectName} (${data.byteLength} bytes)`)
  return blob
}

async function pruneBackups(token, { retentionDays = RETENTION_DAYS, dryRun = false } = {}) {
  const blobs = await listAllBlobs(token, BACKUP_PREFIX)
  const expired = selectExpiredBackups(
    blobs.map((b) => b.pathname),
    { retentionDays },
  )
  for (const blob of blobs) {
    if (!expired.includes(blob.pathname)) continue
    if (dryRun) {
      console.log(`[dry-run] would delete ${blob.pathname}`)
    } else {
      await del(blob.url, { token })
      console.log(`Deleted expired backup ${blob.pathname}`)
    }
  }
  if (expired.length === 0) console.log('No expired backups to delete')
  return expired
}

async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) {
    console.error('error: BLOB_READ_WRITE_TOKEN is not set')
    process.exit(1)
  }
  const args = process.argv.slice(2)
  const dumpPath = args.find((a) => !a.startsWith('-'))
  if (!dumpPath) {
    console.error('usage: node scripts/db-backup.mjs <dump-file> [--dry-run] [--retention-days N]')
    process.exit(1)
  }
  const dryRun = args.includes('--dry-run')
  const retentionArg = args[args.indexOf('--retention-days') + 1]
  const retentionDays = retentionArg ? Number(retentionArg) : RETENTION_DAYS
  if (!Number.isFinite(retentionDays) || retentionDays < 0) {
    console.error('error: --retention-days must be a non-negative number')
    process.exit(1)
  }

  await uploadBackup(dumpPath, token)
  await pruneBackups(token, { retentionDays, dryRun })
}

const invokedAsScript =
  process.argv[1] != null &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedAsScript) {
  main().catch((err) => {
    console.error('db-backup failed:', err)
    process.exit(1)
  })
}
