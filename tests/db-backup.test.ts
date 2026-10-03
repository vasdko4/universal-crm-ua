import { describe, expect, it } from 'vitest'
import { backupPathFor, backupsToDelete, BACKUP_RETENTION_DAYS } from '@/lib/shop/db-backup'

describe('backupPathFor', () => {
  it('formats the UTC timestamp as db-backups/YYYY-MM-DD-HHmm.jsonl.gz', () => {
    const d = new Date(Date.UTC(2026, 9, 1, 0, 30))
    expect(backupPathFor(d)).toBe('db-backups/2026-10-01-0030.jsonl.gz')
  })

  it('zero-pads single-digit parts', () => {
    const d = new Date(Date.UTC(2026, 0, 5, 4, 7))
    expect(backupPathFor(d)).toBe('db-backups/2026-01-05-0407.jsonl.gz')
  })

  it('appends the secret suffix before the extension', () => {
    const d = new Date(Date.UTC(2026, 9, 1, 0, 30))
    expect(backupPathFor(d, 'a1b2c3')).toBe('db-backups/2026-10-01-0030-a1b2c3.jsonl.gz')
  })
})

describe('backupsToDelete with secret suffix', () => {
  it('still parses the date from suffixed filenames', () => {
    const now = new Date(Date.UTC(2026, 9, 11, 12, 0))
    const names = ['db-backups/2026-09-30-0030-deadbeef00.jsonl.gz', 'db-backups/2026-10-10-0030-cafe1234.jsonl.gz']
    expect(backupsToDelete(names, now, BACKUP_RETENTION_DAYS)).toEqual(['db-backups/2026-09-30-0030-deadbeef00.jsonl.gz'])
  })
})

describe('BACKUP_RETENTION_DAYS', () => {
  it('keeps exactly 10 days', () => {
    expect(BACKUP_RETENTION_DAYS).toBe(10)
  })
})

describe('backupsToDelete', () => {
  const now = new Date(Date.UTC(2026, 9, 11, 12, 0))

  it('keeps backups within the retention window', () => {
    const keep = ['db-backups/2026-10-11-0030.jsonl.gz', 'db-backups/2026-10-05-0030.jsonl.gz']
    expect(backupsToDelete(keep, now, BACKUP_RETENTION_DAYS)).toEqual([])
  })

  it('deletes backups strictly older than 10 days', () => {
    const names = [
      'db-backups/2026-10-01-0030.jsonl.gz', // 10d 11.5h old -> delete
      'db-backups/2026-09-30-0030.jsonl.gz', // 11d old -> delete
      'db-backups/2026-10-02-0030.jsonl.gz', // 9d old -> keep
    ]
    expect(backupsToDelete(names, now, BACKUP_RETENTION_DAYS)).toEqual([
      'db-backups/2026-10-01-0030.jsonl.gz',
      'db-backups/2026-09-30-0030.jsonl.gz',
    ])
  })

  it('never deletes future-dated or unrecognized files', () => {
    const names = [
      'db-backups/2026-10-12-0030.jsonl.gz',
      'db-backups/readme.txt',
      'db-backups/2020-01-01-0000.dump',
    ]
    expect(backupsToDelete(names, now, BACKUP_RETENTION_DAYS)).toEqual([])
  })

  it('respects a custom retention window', () => {
    const names = ['db-backups/2026-10-05-0030.jsonl.gz']
    expect(backupsToDelete(names, now, 5)).toEqual(names)
    expect(backupsToDelete(names, now, 7)).toEqual([])
  })
})
