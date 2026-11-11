import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isUsableSetupToken, isBlockedPostgresHost, postgresHostFromUrl } from '@/lib/setup-token'

const root = resolve(import.meta.dirname, '..')
// Structural tests compare source text with LF literals; normalize so the
// file also passes on a Windows CRLF checkout.
const source = (file: string) => readFileSync(resolve(root, file), 'utf8').replace(/\r\n/g, '\n')

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

describe('setup token revocation wiring (audit P1)', () => {
  it('runSetup revokes the token on the success path only', () => {
    const src = source('app/actions/setup.ts')
    expect(src).toMatch(
      /import \{[^}]*revokeSetupToken[^}]*\} from '@\/lib\/setup-token'/,
    )
    const revokeAt = src.indexOf('revokeSetupToken()')
    expect(revokeAt).toBeGreaterThan(-1)
    // The revoke call sits before the success return at the end of runSetup.
    const successAt = src.indexOf('return { success: true as const }')
    expect(revokeAt).toBeLessThan(successAt)
    // Failure path: the catch block must not revoke — a failed setup keeps
    // the token so the operator can retry runSetup.
    const catchAt = src.lastIndexOf('} catch (e) {')
    expect(src.slice(catchAt)).not.toContain('revokeSetupToken')
  })

  it('saveDatabaseConfig does not revoke the token (two-step setup flow)', () => {
    // saveDatabaseConfig runs first; revoking there would break runSetup.
    expect(source('app/actions/db-config.ts')).not.toContain('revokeSetupToken')
  })

  it('saveDatabaseConfig bounds the throwaway probe connection', () => {
    const src = source('app/actions/db-config.ts')
    expect(src).toMatch(/new Client\(\{[^}]*connectionTimeoutMillis: 10_000/s)
    expect(src).toContain("SET statement_timeout = '120s'")
  })
})
