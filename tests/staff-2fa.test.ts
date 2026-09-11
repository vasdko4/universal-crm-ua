import { describe, it, expect } from 'vitest'
import {
  generateTotpSecret,
  otpauthUrl,
  totpAt,
  twoFactorCookieValid,
  twoFactorCookieValue,
  verifyTotp,
} from '@/lib/staff-2fa'

describe('staff TOTP', () => {
  it('round-trips a code for the current window', () => {
    const secret = generateTotpSecret()
    expect(secret.length).toBeGreaterThan(10)
    const now = Date.UTC(2026, 8, 8, 12, 0, 5)
    const code = totpAt(secret, Math.floor(now / 1000))
    expect(code).toMatch(/^\d{6}$/)
    expect(verifyTotp(secret, code, now)).toBe(true)
    expect(verifyTotp(secret, '000000', now)).toBe(false)
  })

  it('accepts an adjacent 30s window', () => {
    const secret = generateTotpSecret()
    const now = Date.UTC(2026, 8, 8, 12, 0, 5)
    const prev = totpAt(secret, Math.floor(now / 1000) - 30)
    expect(verifyTotp(secret, prev, now)).toBe(true)
  })

  it('builds an otpauth URL', () => {
    const url = otpauthUrl({ secret: 'MFRGGZDFMZTWQ2LK', account: 'admin@store', issuer: 'Universal Magazine' })
    expect(url).toContain('otpauth://totp/')
    expect(url).toContain('secret=MFRGGZDFMZTWQ2LK')
  })

  it('HMACs the 2FA cookie to the current session', () => {
    const v = twoFactorCookieValue('user-1', 's3cret', 'sess-1')
    expect(twoFactorCookieValid('user-1', 's3cret', v, 'sess-1')).toBe(true)
    expect(twoFactorCookieValid('user-1', 's3cret', v, 'sess-2')).toBe(false)
    expect(twoFactorCookieValid('user-1', 's3cret', v)).toBe(false)
    expect(twoFactorCookieValid('user-1', 's3cret', 'nope', 'sess-1')).toBe(false)
    expect(twoFactorCookieValid('other', 's3cret', v, 'sess-1')).toBe(false)
  })
})
