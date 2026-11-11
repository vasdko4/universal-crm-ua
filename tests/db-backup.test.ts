import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { backupFilenameFor, backupsToDelete, BACKUP_RETENTION_DAYS } from '@/lib/shop/db-backup'

const root = resolve(import.meta.dirname, '..')
// Structural tests compare source text with LF literals; normalize CRLF so
// they also pass on a Windows checkout (see the CRLF fix, 11.11.2026).
const source = (file: string) => readFileSync(resolve(root, file), 'utf8').replace(/\r\n/g, '\n')

describe('backupFilenameFor', () => {
  it('formats the UTC timestamp as YYYY-MM-DD-HHmmss.jsonl.gz', () => {
    const d = new Date(Date.UTC(2026, 9, 1, 0, 30))
    expect(backupFilenameFor(d)).toBe('2026-10-01-003000.jsonl.gz')
  })

  it('zero-pads single-digit parts', () => {
    const d = new Date(Date.UTC(2026, 0, 5, 4, 7))
    expect(backupFilenameFor(d)).toBe('2026-01-05-040700.jsonl.gz')
  })

  it('includes seconds so two runs in the same minute never collide (audit A4)', () => {
    const a = new Date(Date.UTC(2026, 9, 1, 0, 30, 5))
    const b = new Date(Date.UTC(2026, 9, 1, 0, 30, 45))
    expect(backupFilenameFor(a)).toBe('2026-10-01-003005.jsonl.gz')
    expect(backupFilenameFor(b)).toBe('2026-10-01-003045.jsonl.gz')
    expect(backupFilenameFor(a)).not.toBe(backupFilenameFor(b))
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
    const keep = ['2026-10-11-003000.jsonl.gz', '2026-10-05-003000.jsonl.gz']
    expect(backupsToDelete(keep, now, BACKUP_RETENTION_DAYS)).toEqual([])
  })

  it('deletes backups strictly older than 10 days', () => {
    const names = [
      '2026-10-01-003000.jsonl.gz', // 10d 11.5h old -> delete
      '2026-09-30-003000.jsonl.gz', // 11d old -> delete
      '2026-10-02-003000.jsonl.gz', // 9d old -> keep
    ]
    expect(backupsToDelete(names, now, BACKUP_RETENTION_DAYS)).toEqual([
      '2026-10-01-003000.jsonl.gz',
      '2026-09-30-003000.jsonl.gz',
    ])
  })

  it('never deletes future-dated or unrecognized files', () => {
    const names = [
      '2026-10-12-003000.jsonl.gz',
      'readme.txt',
      '2020-01-01-0000.dump',
    ]
    expect(backupsToDelete(names, now, BACKUP_RETENTION_DAYS)).toEqual([])
  })

  it('respects a custom retention window', () => {
    const names = ['2026-10-05-003000.jsonl.gz']
    expect(backupsToDelete(names, now, 5)).toEqual(names)
    expect(backupsToDelete(names, now, 7)).toEqual([])
  })

  it('still prunes pre-3.4.93 HHmm filenames (seconds optional)', () => {
    const names = ['2026-10-01-0030.jsonl.gz', '2026-10-02-0030.jsonl.gz']
    expect(backupsToDelete(names, now, BACKUP_RETENTION_DAYS)).toEqual(['2026-10-01-0030.jsonl.gz'])
  })
})

describe('audit A15: restore instruction names the right script', () => {
  it('route docstring points to db-restore-backup.mjs (local file), not db-restore.mjs', () => {
    const route = source('app/api/cron/db-backup/route.ts')
    expect(route).toContain('scripts/db-restore-backup.mjs')
    expect(route).not.toContain('scripts/db-restore.mjs')
  })

  it('docs describe local-disk storage and the local-file restore path', () => {
    const doc = source('docs/db-backup.md')
    expect(doc).toContain('local disk')
    expect(doc).not.toContain('Storage:** Vercel Blob')
    expect(doc).toContain('scripts/db-restore-backup.mjs ./backup.jsonl.gz')
  })
})

describe('audit A17: backup streams instead of buffering', () => {
  const src = source('lib/shop/db-backup.ts')

  it('uses a gzip stream and bounded batches, not gzipSync on a full body', () => {
    expect(src).toContain('createGzip')
    expect(src).toContain('ORDER BY ctid LIMIT $1 OFFSET $2')
    expect(src).not.toContain('gzipSync')
    expect(src).not.toContain('const lines: string[]')
  })

  it('checks the row cap up front via COUNT(*) and caps compressed bytes', () => {
    expect(src).toContain('SELECT COUNT(*)::int AS c')
    expect(src).toContain('MAX_DUMP_BYTES')
    expect(src).toContain('Backup aborted: dump exceeds')
  })
})

describe('audit A18: manifest carries version + sequences; restorer does setval', () => {
  it('backup records appVersion, schemaSha and sequence positions', () => {
    const src = source('lib/shop/db-backup.ts')
    expect(src).toContain('appVersion: APP_VERSION')
    expect(src).toContain('schemaSha')
    expect(src).toContain('pg_get_serial_sequence')
    expect(src).toContain('last_value')
    expect(src).toContain('sequences')
  })

  it('restorer replays sequences with setval and warns on version mismatch', () => {
    const script = source('scripts/db-restore-backup.mjs')
    expect(script).toContain('SELECT setval($1::regclass, $2, $3)')
    expect(script).toContain('pg_get_serial_sequence')
    expect(script).toContain('MAX("id")')
    expect(script).toContain('WARNING: backup was made by app version')
    expect(script).toContain('WARNING: backup schema sha')
  })
})

describe('audit A19/A20: honest prune count, atomic write', () => {
  const src = source('lib/shop/db-backup.ts')

  it('prune counts successes via allSettled and alerts on failures', () => {
    expect(src).toContain('Promise.allSettled')
    expect(src).toContain("reportError(\n      'cron.db-backup-prune'")
    expect(src).toContain('pruneErrors')
  })

  it('backup file is written via tmp + rename, never directly', () => {
    expect(src).toContain("`${pathname}.tmp`")
    expect(src).toContain('await rename(tmpPathname, pathname)')
    expect(src).not.toContain('await writeFile(pathname, body)')
  })
})
