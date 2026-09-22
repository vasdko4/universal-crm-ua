import { describe, it, expect } from 'vitest'
import { isUsableSetupToken, isBlockedPostgresHost, postgresHostFromUrl } from '@/lib/setup-token'

describe('isUsableSetupToken', () => {
  it('rejects missing, short and placeholder values', () => {
    expect(isUsableSetupToken(undefined)).toBe(false)
    expect(isUsableSetupToken('')).toBe(false)
    expect(isUsableSetupToken('short')).toBe(false)
    expect(isUsableSetupToken('replace-me-with-openssl-rand-base64-32')).toBe(false)
    expect(isUsableSetupToken('changeme')).toBe(false)
  })

  it('accepts a real openssl-sized secret', () => {
    expect(isUsableSetupToken('k7Qe2mN9pL4sT1wX8zY0aB3cD6eF')).toBe(true)
  })
})

describe('isBlockedPostgresHost', () => {
  it('blocks cloud metadata and unspecified addresses', () => {
    expect(isBlockedPostgresHost('169.254.169.254')).toBe(true)
    expect(isBlockedPostgresHost('metadata.google.internal')).toBe(true)
    expect(isBlockedPostgresHost('0.0.0.0')).toBe(true)
    expect(isBlockedPostgresHost('224.0.0.1')).toBe(true)
  })

  it('allows loopback, RFC1918 and public hosts (token already required)', () => {
    expect(isBlockedPostgresHost('localhost')).toBe(false)
    expect(isBlockedPostgresHost('127.0.0.1')).toBe(false)
    expect(isBlockedPostgresHost('10.0.0.4')).toBe(false)
    expect(isBlockedPostgresHost('db.example.com')).toBe(false)
    expect(isBlockedPostgresHost('::1')).toBe(false)
  })
})

describe('postgresHostFromUrl', () => {
  it('extracts the hostname from a postgres URL', () => {
    expect(postgresHostFromUrl('postgres://u:p@10.0.0.8:5432/db')).toBe('10.0.0.8')
    expect(postgresHostFromUrl('not a url')).toBeNull()
  })
})
