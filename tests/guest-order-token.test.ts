import { describe, it, expect } from 'vitest'
import {
  GUEST_ACCESS_TOKEN_RE,
  createGuestAccessToken,
  hashGuestAccessToken,
  isGuestAccessTokenFormat,
  verifyGuestAccessToken,
} from '@/lib/orders/guest-token'

// Guest order access token (3.4.107, fix 5): the pf_last_order cookie used to
// hold the plain 12-digit order number, so anyone who knew a number could
// read the whole order (name, phone, email, address) on /order/[n] and
// /checkout/pay/[n]. The cookie now holds a random token; the DB stores
// only its SHA-256 hash.

describe('createGuestAccessToken', () => {
  it('returns a 43-char base64url token (32 random bytes, no padding)', () => {
    const { token } = createGuestAccessToken()
    expect(token).toHaveLength(43)
    expect(token).toMatch(GUEST_ACCESS_TOKEN_RE)
  })

  it('uses only the base64url alphabet — no +, / or = padding', () => {
    for (let i = 0; i < 20; i++) {
      const { token } = createGuestAccessToken()
      expect(token).not.toMatch(/[+/=]/)
    }
  })

  it('returns a 64-char lowercase hex SHA-256 hash', () => {
    const { tokenHash } = createGuestAccessToken()
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('issues distinct tokens with distinct hashes on every call', () => {
    const a = createGuestAccessToken()
    const b = createGuestAccessToken()
    expect(a.token).not.toBe(b.token)
    expect(a.tokenHash).not.toBe(b.tokenHash)
  })
})

describe('hashGuestAccessToken', () => {
  it('matches the known SHA-256 vector for "abc"', () => {
    expect(hashGuestAccessToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('is deterministic for the same input', () => {
    expect(hashGuestAccessToken('some-token')).toBe(hashGuestAccessToken('some-token'))
  })

  it('reproduces the hash stored by createGuestAccessToken for its token', () => {
    const { token, tokenHash } = createGuestAccessToken()
    expect(hashGuestAccessToken(token)).toBe(tokenHash)
  })
})

describe('isGuestAccessTokenFormat', () => {
  it('accepts a real token', () => {
    expect(isGuestAccessTokenFormat(createGuestAccessToken().token)).toBe(true)
  })

  it('rejects a legacy 12-digit order number', () => {
    expect(isGuestAccessTokenFormat('123456789012')).toBe(false)
  })

  it('rejects empty, short, and non-string values', () => {
    expect(isGuestAccessTokenFormat('')).toBe(false)
    expect(isGuestAccessTokenFormat('short')).toBe(false)
    expect(isGuestAccessTokenFormat('A'.repeat(44))).toBe(false)
    expect(isGuestAccessTokenFormat(123456789012)).toBe(false)
    expect(isGuestAccessTokenFormat(null)).toBe(false)
    expect(isGuestAccessTokenFormat(undefined)).toBe(false)
  })
})

describe('verifyGuestAccessToken', () => {
  it('accepts the matching token/hash pair', () => {
    const { token, tokenHash } = createGuestAccessToken()
    expect(verifyGuestAccessToken(token, tokenHash)).toBe(true)
  })

  it('rejects a wrong token for the stored hash', () => {
    const { tokenHash } = createGuestAccessToken()
    expect(verifyGuestAccessToken(createGuestAccessToken().token, tokenHash)).toBe(false)
  })

  it('rejects a legacy plain order number as the token', () => {
    const { tokenHash } = createGuestAccessToken()
    expect(verifyGuestAccessToken('123456789012', tokenHash)).toBe(false)
  })

  it('rejects empty/missing tokens and missing or malformed hashes', () => {
    const { token, tokenHash } = createGuestAccessToken()
    expect(verifyGuestAccessToken('', tokenHash)).toBe(false)
    expect(verifyGuestAccessToken(null, tokenHash)).toBe(false)
    expect(verifyGuestAccessToken(undefined, tokenHash)).toBe(false)
    expect(verifyGuestAccessToken(token, null)).toBe(false)
    expect(verifyGuestAccessToken(token, undefined)).toBe(false)
    expect(verifyGuestAccessToken(token, 'deadbeef')).toBe(false)
    expect(verifyGuestAccessToken(token, 'z'.repeat(64))).toBe(false)
    expect(verifyGuestAccessToken(token, tokenHash.toUpperCase())).toBe(false)
  })
})
