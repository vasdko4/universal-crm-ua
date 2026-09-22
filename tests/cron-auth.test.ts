import { describe, it, expect } from 'vitest'
import { authorizeCronRequest, isUsableCronSecret } from '@/lib/cron-auth'

const GOOD = 'S3cGk0jQ0m0mqk0tS7Yyx6ZbYt0kq4Yp3mVtqH9cKpY='

describe('isUsableCronSecret', () => {
  it('rejects missing, blank and short secrets', () => {
    expect(isUsableCronSecret(undefined)).toBe(false)
    expect(isUsableCronSecret(null)).toBe(false)
    expect(isUsableCronSecret('')).toBe(false)
    expect(isUsableCronSecret('   ')).toBe(false)
    expect(isUsableCronSecret('short')).toBe(false)
  })

  it('rejects the placeholders shipped in example env files', () => {
    expect(isUsableCronSecret('replace-me-with-openssl-rand-base64-32')).toBe(false)
    expect(isUsableCronSecret('REPLACE-ME-WITH-OPENSSL-RAND-BASE64-32')).toBe(false)
    expect(isUsableCronSecret('your-secret-here')).toBe(false)
  })

  it('accepts a generated secret', () => {
    expect(isUsableCronSecret(GOOD)).toBe(true)
    expect(isUsableCronSecret(` ${GOOD} `)).toBe(true)
  })
})

describe('authorizeCronRequest', () => {
  it('fails closed with 503 when no usable secret is configured', () => {
    expect(authorizeCronRequest(undefined, `Bearer ${GOOD}`)).toEqual({
      ok: false,
      status: 503,
      error: 'CRON_SECRET is not configured',
    })
    // A placeholder secret must not open the endpoint either, even when the
    // caller happens to send exactly that placeholder.
    const placeholder = 'replace-me-with-openssl-rand-base64-32'
    expect(authorizeCronRequest(placeholder, `Bearer ${placeholder}`)).toMatchObject({
      ok: false,
      status: 503,
    })
  })

  it('rejects a missing or wrong Authorization header with 401', () => {
    expect(authorizeCronRequest(GOOD, undefined)).toMatchObject({ ok: false, status: 401 })
    expect(authorizeCronRequest(GOOD, '')).toMatchObject({ ok: false, status: 401 })
    expect(authorizeCronRequest(GOOD, GOOD)).toMatchObject({ ok: false, status: 401 })
    expect(authorizeCronRequest(GOOD, 'Bearer wrong-secret-value-000')).toMatchObject({
      ok: false,
      status: 401,
    })
  })

  it('authorizes the matching bearer token', () => {
    expect(authorizeCronRequest(GOOD, `Bearer ${GOOD}`)).toEqual({ ok: true })
  })
})
