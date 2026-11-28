import { describe, expect, it } from 'vitest'
import { randomBytes } from 'node:crypto'
import {
  BACKUP_ENCRYPTION_KEY_ENV,
  hasBackupEncryptionKey,
} from '@/lib/shop/backup-crypto'

// Backup-key dashboard warning (3.4.111): the admin dashboard warns when
// BACKUP_ENCRYPTION_KEY is missing, so the fail-closed backup writer
// (3.4.109) surfaces right after a redeploy instead of at the 02:30 run.
// The check is presence-only and never throws: validity (base64, 32 bytes)
// is currentBackupKey()'s job at backup time, and the key value itself is
// never read out, logged, or rendered here.

describe('hasBackupEncryptionKey', () => {
  it('returns false when the key is missing', () => {
    expect(hasBackupEncryptionKey({})).toBe(false)
    expect(hasBackupEncryptionKey({ [BACKUP_ENCRYPTION_KEY_ENV]: undefined })).toBe(false)
  })

  it('returns false for an empty or whitespace-only key', () => {
    expect(hasBackupEncryptionKey({ [BACKUP_ENCRYPTION_KEY_ENV]: '' })).toBe(false)
    expect(hasBackupEncryptionKey({ [BACKUP_ENCRYPTION_KEY_ENV]: '   ' })).toBe(false)
  })

  it('returns true when the key is set', () => {
    const key = randomBytes(32).toString('base64')
    expect(hasBackupEncryptionKey({ [BACKUP_ENCRYPTION_KEY_ENV]: key })).toBe(true)
  })

  it('never throws, including with no env passed', () => {
    expect(() => hasBackupEncryptionKey({})).not.toThrow()
    expect(() => hasBackupEncryptionKey({ [BACKUP_ENCRYPTION_KEY_ENV]: '' })).not.toThrow()
  })

  it('matches the dashboard condition: missing key shows the warning, set key hides it', () => {
    // The dashboard renders the warning exactly when !hasBackupEncryptionKey().
    expect(!hasBackupEncryptionKey({})).toBe(true)
    expect(!hasBackupEncryptionKey({ [BACKUP_ENCRYPTION_KEY_ENV]: randomBytes(32).toString('base64') })).toBe(false)
  })
})
