import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { requiredReauthForEmailChange } from '@/lib/shop/email-change-reauth'

const root = resolve(import.meta.dirname, '..')
const source = (file: string) => readFileSync(resolve(root, file), 'utf8')

describe('requiredReauthForEmailChange', () => {
  it('blocks Google-linked accounts outright', () => {
    expect(requiredReauthForEmailChange({ google: true, hasPassword: true })).toBe('blocked')
    expect(requiredReauthForEmailChange({ google: true, hasPassword: false })).toBe('blocked')
  })

  it('requires the current password for credential accounts', () => {
    expect(requiredReauthForEmailChange({ google: false, hasPassword: true })).toBe('password')
  })

  it('requires a code to the current email for passwordless accounts', () => {
    expect(requiredReauthForEmailChange({ google: false, hasPassword: false })).toBe(
      'old-email-code',
    )
  })
})

describe('shopper account-takeover fix (structural)', () => {
  it('getShopUser binds the session like getAdminUser', () => {
    const src = source('lib/session.ts')
    // The binding call must appear in getShopUser, not just getAdminUser.
    const shopUserAt = src.indexOf('export async function getShopUser')
    expect(shopUserAt).toBeGreaterThan(-1)
    const bindingAt = src.indexOf('validateSessionBinding(', shopUserAt)
    expect(bindingAt).toBeGreaterThan(shopUserAt)
  })

  it('requestEmailChange verifies the current password server-side', () => {
    const src = source('app/actions/shop-auth.ts')
    expect(src).toContain('verifyPassword({ hash: storedHash, password: currentPassword })')
    expect(src).toContain('hasCredentialPassword(user.id)')
    expect(src).toContain('Невірний поточний пароль')
  })

  it('confirmEmailChange revokes other sessions like confirmPasswordChange', () => {
    const src = source('app/actions/shop-auth.ts')
    // Both confirm flows must call the shared helper after the credential
    // change — a stolen session on another device must not survive it.
    const emailAt = src.indexOf('export async function confirmEmailChange')
    expect(emailAt).toBeGreaterThan(-1)
    const emailRevokeAt = src.indexOf('await revokeOtherSessions(user.id)', emailAt)
    expect(emailRevokeAt).toBeGreaterThan(emailAt)
    const passwordAt = src.indexOf('export async function confirmPasswordChange')
    expect(passwordAt).toBeGreaterThan(-1)
    const passwordRevokeAt = src.indexOf('await revokeOtherSessions(user.id)', passwordAt)
    expect(passwordRevokeAt).toBeGreaterThan(passwordAt)
    // The helper keeps the current session and deletes the rest; when the
    // current session cannot be identified it revokes all of them.
    expect(src).toContain('DELETE FROM session WHERE "userId" = $1 AND id <> $2')
    expect(src).toContain('DELETE FROM session WHERE "userId" = $1')
  })

  it('passwordless accounts prove the old address with a consumed code', () => {
    const src = source('app/actions/shop-auth.ts')
    expect(src).toContain('email-change-old:${user.id}')
    expect(src).toContain('requestOldEmailChangeCode')
  })

  it('confirmEmailChange still requires the new-address code', () => {
    const src = source('app/actions/shop-auth.ts')
    const fnAt = src.indexOf('export async function confirmEmailChange')
    expect(fnAt).toBeGreaterThan(-1)
    const section = src.slice(fnAt)
    expect(section).toContain('email-change:${user.id}')
    expect(section).toContain("value::jsonb->>'codeHash'")
  })
})
