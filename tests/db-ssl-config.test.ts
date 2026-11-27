import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveSslCa, sslForConnectionString } from '@/lib/db/config'

const PEM = '-----BEGIN CERTIFICATE-----\nMIIBFAKE\n-----END CERTIFICATE-----\n'
// Same cert as it is usually stored in .env: literal \n escapes, no real newlines.
const PEM_ESCAPED = '-----BEGIN CERTIFICATE-----\\nMIIBFAKE\\n-----END CERTIFICATE-----\\n'

const LOCAL_URL = 'postgresql://user:pass@localhost:5432/store'
const REQUIRE_URL = 'postgresql://user:pass@db.example.com:5432/store?sslmode=require'
const VERIFY_FULL_URL = 'postgresql://user:pass@db.example.com:5432/store?sslmode=verify-full'
const VERIFY_CA_URL = 'postgresql://user:pass@db.example.com:5432/store?sslmode=verify-ca'
const NEON_URL = 'postgresql://user:pass@ep-foo-123.eu-central-1.aws.neon.tech:5432/store'

describe('sslForConnectionString', () => {
  const savedCa = process.env.DB_SSL_CA
  const savedCert = process.env.PGSSLROOTCERT

  beforeEach(() => {
    delete process.env.DB_SSL_CA
    delete process.env.PGSSLROOTCERT
  })

  afterEach(() => {
    if (savedCa === undefined) delete process.env.DB_SSL_CA
    else process.env.DB_SSL_CA = savedCa
    if (savedCert === undefined) delete process.env.PGSSLROOTCERT
    else process.env.PGSSLROOTCERT = savedCert
  })

  it('returns false for a local Postgres URL (no TLS)', () => {
    expect(sslForConnectionString(LOCAL_URL)).toBe(false)
  })

  it('returns rejectUnauthorized:false for sslmode=require (deliberate tradeoff)', () => {
    expect(sslForConnectionString(REQUIRE_URL)).toEqual({ rejectUnauthorized: false })
  })

  it('returns rejectUnauthorized:false for managed hosts without an explicit sslmode', () => {
    expect(sslForConnectionString(NEON_URL)).toEqual({ rejectUnauthorized: false })
  })

  it('verify-full with DB_SSL_CA returns rejectUnauthorized:true with the CA', () => {
    process.env.DB_SSL_CA = PEM
    // resolveSslCa() trims the env value, so the trailing newline is gone;
    // node-postgres accepts the PEM either way.
    expect(sslForConnectionString(VERIFY_FULL_URL)).toEqual({ rejectUnauthorized: true, ca: PEM.trim() })
  })

  it('verify-ca with PGSSLROOTCERT reads the CA from the file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ssl-ca-'))
    try {
      const file = join(dir, 'ca.pem')
      writeFileSync(file, PEM, 'utf8')
      process.env.PGSSLROOTCERT = file
      expect(sslForConnectionString(VERIFY_CA_URL)).toEqual({ rejectUnauthorized: true, ca: PEM })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('verify-full with no CA throws naming both DB_SSL_CA and PGSSLROOTCERT', () => {
    expect(() => sslForConnectionString(VERIFY_FULL_URL)).toThrow(/DB_SSL_CA/)
    expect(() => sslForConnectionString(VERIFY_FULL_URL)).toThrow(/PGSSLROOTCERT/)
  })

  it('verify-ca with no CA also throws instead of silently connecting unverified', () => {
    expect(() => sslForConnectionString(VERIFY_CA_URL)).toThrow(/DB_SSL_CA/)
    expect(() => sslForConnectionString(VERIFY_CA_URL)).toThrow(/PGSSLROOTCERT/)
  })

  it('DB_SSL_CA wins over PGSSLROOTCERT and literal \\n escapes are normalized', () => {
    process.env.DB_SSL_CA = PEM_ESCAPED
    process.env.PGSSLROOTCERT = '/nonexistent/ca.pem'
    expect(resolveSslCa()).toBe(PEM)
    expect(sslForConnectionString(VERIFY_FULL_URL)).toEqual({ rejectUnauthorized: true, ca: PEM })
  })
})
