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
