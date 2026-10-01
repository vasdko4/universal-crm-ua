import { describe, expect, it } from 'vitest'
import {
  BACKUP_PREFIX,
  RETENTION_DAYS,
  RETENTION_MS,
  buildObjectName,
  formatKyivTimestamp,
  parseBackupTimestamp,
  backupAgeMs,
  isBackupExpired,
  selectExpiredBackups,
} from '../scripts/db-backup.mjs'

const DAY_MS = 24 * 60 * 60 * 1000

function nameAt(ms: number): string {
  return `${BACKUP_PREFIX}${formatKyivTimestamp(new Date(ms))}.dump`
}

describe('formatKyivTimestamp', () => {
  it('formats in Europe/Kyiv, not UTC', () => {
    // 2026-01-15 00:00 UTC is 02:00 in Kyiv (winter, UTC+2)
    expect(formatKyivTimestamp(new Date(Date.UTC(2026, 0, 15, 0, 0)))).toBe('2026-01-15-0200')
    // 2026-07-15 00:00 UTC is 03:00 in Kyiv (summer, UTC+3, DST)
    expect(formatKyivTimestamp(new Date(Date.UTC(2026, 6, 15, 0, 0)))).toBe('2026-07-15-0300')
  })

  it('zero-pads all components', () => {
    expect(formatKyivTimestamp(new Date(Date.UTC(2026, 0, 5, 0, 7)))).toMatch(
      /^\d{4}-\d{2}-\d{2}-\d{4}$/,
    )
  })
})

describe('buildObjectName', () => {
  it('uses the db-backups/ prefix and .dump extension', () => {
    const name = buildObjectName(new Date(Date.UTC(2026, 0, 15, 0, 0)))
    expect(name).toBe('db-backups/2026-01-15-0200.dump')
  })
})

describe('parseBackupTimestamp', () => {
  it('parses a winter name to the correct instant (UTC+2)', () => {
    const parsed = parseBackupTimestamp('db-backups/2026-01-15-0330.dump')
    expect(parsed?.toISOString()).toBe('2026-01-15T01:30:00.000Z')
  })

  it('parses a summer name to the correct instant (UTC+3, DST)', () => {
    const parsed = parseBackupTimestamp('db-backups/2026-07-15-0330.dump')
    expect(parsed?.toISOString()).toBe('2026-07-15T00:30:00.000Z')
  })

  it('round-trips with formatKyivTimestamp', () => {
    const now = Date.now()
    const name = nameAt(now - 3 * DAY_MS)
    const parsed = parseBackupTimestamp(name)
    expect(parsed).not.toBeNull()
    // Round to the minute: names carry minute precision.
    expect(Math.abs(now - 3 * DAY_MS - (parsed?.getTime() ?? 0))).toBeLessThan(60_000)
  })

  it('rejects names that do not match the pattern', () => {
    expect(parseBackupTimestamp('db-backups/2026-01-15.dump')).toBeNull()
    expect(parseBackupTimestamp('db-backups/2026-01-15-0330.sql')).toBeNull()
    expect(parseBackupTimestamp('db-backups/latest.dump')).toBeNull()
    expect(parseBackupTimestamp('db-backups/manual-backup.dump')).toBeNull()
    expect(parseBackupTimestamp('')).toBeNull()
  })

  it('rejects impossible calendar dates', () => {
    expect(parseBackupTimestamp('db-backups/2026-13-01-0000.dump')).toBeNull()
    expect(parseBackupTimestamp('db-backups/2026-02-30-0000.dump')).toBeNull()
    expect(parseBackupTimestamp('db-backups/2026-01-01-2460.dump')).toBeNull()
    expect(parseBackupTimestamp('db-backups/2026-01-01-0060.dump')).toBeNull()
  })

  it('accepts a bare file name without the prefix', () => {
    expect(parseBackupTimestamp('2026-01-15-0330.dump')?.toISOString()).toBe(
      '2026-01-15T01:30:00.000Z',
    )
  })
})

describe('RETENTION constants', () => {
  it('keeps exactly 10 days', () => {
    expect(RETENTION_DAYS).toBe(10)
    expect(RETENTION_MS).toBe(10 * DAY_MS)
  })
})

describe('isBackupExpired', () => {
  const nowMs = Date.UTC(2026, 9, 1, 12, 0, 0) // fixed "now" for determinism

  it('keeps a backup that is exactly 10 days old', () => {
    expect(isBackupExpired(nameAt(nowMs - 10 * DAY_MS), { nowMs })).toBe(false)
  })

  it('deletes a backup that is 10 days and 1 minute old', () => {
    expect(isBackupExpired(nameAt(nowMs - 10 * DAY_MS - 60_000), { nowMs })).toBe(true)
  })

  it('keeps recent backups and deletes clearly old ones', () => {
    expect(isBackupExpired(nameAt(nowMs - 9 * DAY_MS), { nowMs })).toBe(false)
    expect(isBackupExpired(nameAt(nowMs - 11 * DAY_MS), { nowMs })).toBe(true)
    expect(isBackupExpired(nameAt(nowMs - 30 * DAY_MS), { nowMs })).toBe(true)
  })

  it('never expires future-dated backups', () => {
    expect(isBackupExpired(nameAt(nowMs + DAY_MS), { nowMs })).toBe(false)
  })

  it('never expires unrecognized file names', () => {
    expect(isBackupExpired(`${BACKUP_PREFIX}latest.dump`, { nowMs })).toBe(false)
    expect(isBackupExpired(`${BACKUP_PREFIX}manual.dump`, { nowMs })).toBe(false)
  })

  it('honors a custom retention window', () => {
    const name = nameAt(nowMs - 5 * DAY_MS)
    expect(isBackupExpired(name, { nowMs, retentionDays: 3 })).toBe(true)
    expect(isBackupExpired(name, { nowMs, retentionDays: 7 })).toBe(false)
  })
})

describe('backupAgeMs', () => {
  it('returns null for unrecognized names', () => {
    expect(backupAgeMs('db-backups/nope.dump')).toBeNull()
  })

  it('returns the age in milliseconds', () => {
    const nowMs = Date.UTC(2026, 9, 1, 12, 0, 0)
    const age = backupAgeMs(nameAt(nowMs - 2 * DAY_MS), nowMs)
    expect(age).not.toBeNull()
    expect(Math.abs((age ?? 0) - 2 * DAY_MS)).toBeLessThan(60_000)
  })
})

describe('selectExpiredBackups', () => {
  it('returns only expired backups under the prefix', () => {
    const nowMs = Date.UTC(2026, 9, 1, 12, 0, 0)
    const old = nameAt(nowMs - 11 * DAY_MS)
    const fresh = nameAt(nowMs - 2 * DAY_MS)
    const boundary = nameAt(nowMs - 10 * DAY_MS)
    const picked = selectExpiredBackups(
      [old, fresh, boundary, `${BACKUP_PREFIX}latest.dump`, 'other/2020-01-01-0000.dump'],
      { nowMs },
    )
    expect(picked).toEqual([old])
  })

  it('returns an empty list when nothing expired', () => {
    const nowMs = Date.UTC(2026, 9, 1, 12, 0, 0)
    expect(selectExpiredBackups([nameAt(nowMs - DAY_MS)], { nowMs })).toEqual([])
  })
})
