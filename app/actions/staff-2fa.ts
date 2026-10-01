'use server'

import { cookies, headers } from 'next/headers'
import { pool } from '@/lib/db'
import { getAdminUser, getStaffSessionId, staffTwoFactorSatisfied } from '@/lib/session'
import { getAuth } from '@/lib/auth'
import {
  generateTotpSecret,
  otpauthUrl,
  twoFactorCookieValue,
  verifyTotp,
} from '@/lib/staff-2fa'
import { getStoreSettingsInternal } from '@/lib/store-settings'
import { isRateLimited } from '@/lib/api/rate-limit'
import { decryptSecret, encryptSecret } from '@/lib/secrets'

const COOKIE = 'staff_2fa'
const MAX_AGE = 60 * 60 * 24 * 14

function cookieSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET
  if (secret) return secret
  if (process.env.NODE_ENV === 'production') {
    throw new Error('BETTER_AUTH_SECRET is required')
  }
  return 'dev-staff-2fa'
}

export async function getStaffTwoFactorState(): Promise<{
  enabled: boolean
  pending: boolean
}> {
  const me = await getAdminUser()
  if (!me) return { enabled: false, pending: false }
  try {
    const { rows } = await pool.query<{ two_factor_enabled: boolean; two_factor_pending_secret: string | null }>(
      `SELECT two_factor_enabled, two_factor_pending_secret FROM "user" WHERE id = $1`,
      [me.id],
    )
    const row = rows[0]
    return {
      enabled: Boolean(row?.two_factor_enabled),
      pending: Boolean(row?.two_factor_pending_secret),
    }
  } catch {
    return { enabled: false, pending: false }
  }
}

async function setTwoFactorCookie(userId: string) {
  const sessionId = await getStaffSessionId()
  if (!sessionId) throw new Error('no session')
  const jar = await cookies()
  jar.set(COOKIE, twoFactorCookieValue(userId, cookieSecret(), sessionId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  })
}

export async function beginStaffTwoFactor(): Promise<
  { ok: true; secret: string; otpauth: string } | { ok: false; error: string }
> {
  const me = await getAdminUser()
  if (!me) return { ok: false, error: 'Не авторизовано' }
  try {
    const { rows } = await pool.query<{ two_factor_enabled: boolean }>(
      `SELECT two_factor_enabled FROM "user" WHERE id = $1`,
      [me.id],
    )
    if (rows[0]?.two_factor_enabled && !(await staffTwoFactorSatisfied(me.id))) {
      return { ok: false, error: 'Спочатку підтвердіть поточний код 2FA' }
    }
    // SECURITY: binding a new authenticator is account-takeover-grade. A
    // stolen session cookie alone must not be enough — require a FRESH login
    // (≤15 min). Otherwise an attacker with the cookie binds their own
    // authenticator, confirms it, and locks the legitimate owner out behind
    // their 2FA. createdAt is the login moment (sliding expiry only moves
    // expiresAt), so this is a genuine re-authentication check.
    if (!rows[0]?.two_factor_enabled) {
      const auth = await getAuth()
      const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
      const createdAt = session?.session?.createdAt ? new Date(session.session.createdAt).getTime() : NaN
      if (!Number.isFinite(createdAt) || Date.now() - createdAt > 15 * 60 * 1000) {
        return { ok: false, error: 'З міркувань безпеки увімкнення 2FA потребує свіжого входу — вийдіть і увійдіть знову.' }
      }
    }
    const secret = generateTotpSecret()
    // BUGFIX: TOTP secrets used to be stored in plaintext. Encrypt at rest;
    // decryptSecret passes legacy plaintext rows through, so no data migration needed.
    await pool.query(`UPDATE "user" SET two_factor_pending_secret = $1, "updatedAt" = NOW() WHERE id = $2`, [
      encryptSecret(secret),
      me.id,
    ])
    const settings = await getStoreSettingsInternal().catch(() => null)
    const issuer = settings?.storeName?.trim() || 'Мій магазин'
    const otpauth = otpauthUrl({ secret, account: me.email, issuer })
    return { ok: true, secret, otpauth }
  } catch (e) {
    console.error('[staff-2fa] beginStaffTwoFactor failed:', e)
    return { ok: false, error: 'Не вдалося увімкнути 2FA. Оновіть сторінку і спробуйте ще раз.' }
  }
}

export async function confirmStaffTwoFactor(code: string): Promise<{ ok: boolean; error?: string }> {
  const me = await getAdminUser()
  if (!me) return { ok: false, error: 'Не авторизовано' }
  if (await isRateLimited('staff-2fa', me.id, 5)) {
    return { ok: false, error: 'Забагато спроб. Зачекайте хвилину.' }
  }
  try {
    const { rows } = await pool.query<{ two_factor_pending_secret: string | null }>(
      `SELECT two_factor_pending_secret FROM "user" WHERE id = $1`,
      [me.id],
    )
    const secret = decryptSecret(rows[0]?.two_factor_pending_secret)
    if (!secret) return { ok: false, error: 'Спочатку згенеруйте секрет' }
    if (!verifyTotp(secret, code)) return { ok: false, error: 'Невірний код' }
    await pool.query(
      `UPDATE "user" SET two_factor_secret = $1, two_factor_enabled = true, two_factor_pending_secret = NULL, "updatedAt" = NOW() WHERE id = $2`,
      [encryptSecret(secret), me.id],
    )
    await setTwoFactorCookie(me.id)
    return { ok: true }
  } catch (e) {
    console.error('[staff-2fa] confirmStaffTwoFactor failed:', e)
    return { ok: false, error: 'Не вдалося підтвердити 2FA.' }
  }
}

export async function disableStaffTwoFactor(code: string): Promise<{ ok: boolean; error?: string }> {
  const me = await getAdminUser()
  if (!me) return { ok: false, error: 'Не авторизовано' }
  if (await isRateLimited('staff-2fa', me.id, 5)) {
    return { ok: false, error: 'Забагато спроб. Зачекайте хвилину.' }
  }
  const { rows } = await pool.query<{ two_factor_secret: string | null; two_factor_enabled: boolean | null }>(
    `SELECT two_factor_secret, two_factor_enabled FROM "user" WHERE id = $1`,
    [me.id],
  )
  const secret = decryptSecret(rows[0]?.two_factor_secret)
  // BUGFIX: when two_factor_enabled was true but the secret was NULL
  // (corrupt state), the code check was skipped entirely and 2FA got
  // disabled with no verification. Refuse instead of silently disabling.
  if (rows[0]?.two_factor_enabled && !secret) {
    return { ok: false, error: '2FA у пошкодженому стані — зверніться до адміністратора' }
  }
  if (secret && !verifyTotp(secret, code)) return { ok: false, error: 'Невірний код' }
  await pool.query(
    `UPDATE "user" SET two_factor_secret = NULL, two_factor_enabled = false, two_factor_pending_secret = NULL, "updatedAt" = NOW() WHERE id = $1`,
    [me.id],
  )
  const jar = await cookies()
  jar.delete(COOKIE)
  return { ok: true }
}

export async function verifyStaffTwoFactorLogin(code: string): Promise<{ ok: boolean; error?: string }> {
  const me = await getAdminUser()
  if (!me) return { ok: false, error: 'Не авторизовано' }
  if (await isRateLimited('staff-2fa', me.id, 5)) {
    return { ok: false, error: 'Забагато спроб. Зачекайте хвилину.' }
  }
  const { rows } = await pool.query<{ two_factor_secret: string | null; two_factor_enabled: boolean }>(
    `SELECT two_factor_secret, two_factor_enabled FROM "user" WHERE id = $1`,
    [me.id],
  )
  const row = rows[0]
  if (!row?.two_factor_enabled || !row.two_factor_secret) return { ok: false, error: '2FA не увімкнено' }
  if (!verifyTotp(decryptSecret(row.two_factor_secret), code)) return { ok: false, error: 'Невірний код' }
  try {
    await setTwoFactorCookie(me.id)
  } catch {
    return { ok: false, error: 'Сесія застаріла. Увійдіть ще раз.' }
  }
  return { ok: true }
}

export async function clearStaffTwoFactorCookie(): Promise<void> {
  const jar = await cookies()
  jar.delete(COOKIE)
}

export async function currentUserRequiresTwoFactor(): Promise<boolean> {
  const me = await getAdminUser()
  if (!me) return false
  try {
    const { rows } = await pool.query<{ two_factor_enabled: boolean }>(
      `SELECT two_factor_enabled FROM "user" WHERE id = $1`,
      [me.id],
    )
    return Boolean(rows[0]?.two_factor_enabled)
  } catch {
    return false
  }
}
