'use server'

import { cookies } from 'next/headers'
import { pool } from '@/lib/db'
import { getAdminUser, ensureStaffTwoFactorColumns } from '@/lib/session'
import {
  generateTotpSecret,
  otpauthUrl,
  twoFactorCookieValue,
  verifyTotp,
} from '@/lib/staff-2fa'
import { getStoreSettingsInternal } from '@/lib/store-settings'

const COOKIE = 'staff_2fa'
const MAX_AGE = 60 * 60 * 24 * 14

function cookieSecret(): string {
  return process.env.BETTER_AUTH_SECRET || 'dev-staff-2fa'
}

export async function getStaffTwoFactorState(): Promise<{
  enabled: boolean
  pending: boolean
}> {
  const me = await getAdminUser()
  if (!me) return { enabled: false, pending: false }
  try {
    await ensureStaffTwoFactorColumns()
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

export async function beginStaffTwoFactor(): Promise<
  { ok: true; secret: string; otpauth: string } | { ok: false; error: string }
> {
  const me = await getAdminUser()
  if (!me) return { ok: false, error: 'Не авторизовано' }
  try {
    await ensureStaffTwoFactorColumns()
    const secret = generateTotpSecret()
    await pool.query(`UPDATE "user" SET two_factor_pending_secret = $1, "updatedAt" = NOW() WHERE id = $2`, [
      secret,
      me.id,
    ])
    const settings = await getStoreSettingsInternal().catch(() => null)
    const issuer = settings?.storeName || 'Universal Magazine'
    return { ok: true, secret, otpauth: otpauthUrl({ secret, account: me.email, issuer }) }
  } catch (e) {
    console.error('[staff-2fa] beginStaffTwoFactor failed:', e)
    return { ok: false, error: 'Не вдалося увімкнути 2FA. Оновіть сторінку і спробуйте ще раз.' }
  }
}

export async function confirmStaffTwoFactor(code: string): Promise<{ ok: boolean; error?: string }> {
  const me = await getAdminUser()
  if (!me) return { ok: false, error: 'Не авторизовано' }
  try {
    await ensureStaffTwoFactorColumns()
    const { rows } = await pool.query<{ two_factor_pending_secret: string | null }>(
      `SELECT two_factor_pending_secret FROM "user" WHERE id = $1`,
      [me.id],
    )
    const secret = rows[0]?.two_factor_pending_secret
    if (!secret) return { ok: false, error: 'Спочатку згенеруйте секрет' }
    if (!verifyTotp(secret, code)) return { ok: false, error: 'Невірний код' }
    await pool.query(
      `UPDATE "user" SET two_factor_secret = $1, two_factor_enabled = true, two_factor_pending_secret = NULL, "updatedAt" = NOW() WHERE id = $2`,
      [secret, me.id],
    )
    const jar = await cookies()
    jar.set(COOKIE, twoFactorCookieValue(me.id, cookieSecret()), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: MAX_AGE,
    })
    return { ok: true }
  } catch (e) {
    console.error('[staff-2fa] confirmStaffTwoFactor failed:', e)
    return { ok: false, error: 'Не вдалося підтвердити 2FA.' }
  }
}

export async function disableStaffTwoFactor(code: string): Promise<{ ok: boolean; error?: string }> {
  const me = await getAdminUser()
  if (!me) return { ok: false, error: 'Не авторизовано' }
  await ensureStaffTwoFactorColumns()
  const { rows } = await pool.query<{ two_factor_secret: string | null }>(
    `SELECT two_factor_secret FROM "user" WHERE id = $1`,
    [me.id],
  )
  const secret = rows[0]?.two_factor_secret
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
  await ensureStaffTwoFactorColumns()
  const { rows } = await pool.query<{ two_factor_secret: string | null; two_factor_enabled: boolean }>(
    `SELECT two_factor_secret, two_factor_enabled FROM "user" WHERE id = $1`,
    [me.id],
  )
  const row = rows[0]
  if (!row?.two_factor_enabled || !row.two_factor_secret) return { ok: false, error: '2FA не увімкнено' }
  if (!verifyTotp(row.two_factor_secret, code)) return { ok: false, error: 'Невірний код' }
  const jar = await cookies()
  jar.set(COOKIE, twoFactorCookieValue(me.id, cookieSecret()), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  })
  return { ok: true }
}

export async function currentUserRequiresTwoFactor(): Promise<boolean> {
  const me = await getAdminUser()
  if (!me) return false
  const { rows } = await pool.query<{ two_factor_enabled: boolean }>(
    `SELECT two_factor_enabled FROM "user" WHERE id = $1`,
    [me.id],
  )
  return Boolean(rows[0]?.two_factor_enabled)
}
