import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { getAuth } from '@/lib/auth'
import { db, pool } from '@/lib/db'
import { roles } from '@/lib/db/schema'
import { canWrite, hasPermission, type PermissionKey } from '@/lib/permissions'
import { twoFactorCookieValid } from '@/lib/staff-2fa'
import { clientIpFromHeaders } from '@/lib/api/rate-limit'
import type { Locale } from '@/lib/i18n/config'
import { isLocale } from '@/lib/i18n/config'

/**
 * Anti-stealer protection: binds the session to the IP and User-Agent
 * it was created with. If a stealer copies the cookies to another machine,
 * the IP/UA won't match and the session is killed (user must log in again).
 *
 * Returns true if the session is valid for this request, false if it was
 * killed due to a binding mismatch.
 */
async function validateSessionBinding(
  session: { session: { id: string; ipAddress?: string | null; userAgent?: string | null } },
): Promise<boolean> {
  // Kill-switch: env var (for emergencies) or admin setting (Настройки → Безпека).
  if (process.env.DISABLE_SESSION_BINDING === '1') return true
  try {
    const { rows } = await pool.query<{ session_binding_enabled: boolean | null }>(
      'SELECT session_binding_enabled FROM store_settings WHERE id = 1',
    )
    if (rows[0] && rows[0].session_binding_enabled === false) return true
  } catch {
    // Table/column may not exist yet — fall through to binding check.
  }
  try {
    const h = await headers()
    const currentIp = clientIpFromHeaders(h)
    const currentUa = h.get('user-agent')?.slice(0, 500) ?? ''
    const boundIp = session.session.ipAddress ?? null
    const boundUa = (session.session.userAgent ?? '').slice(0, 500)

    // First request after login may not have stored values yet — bind them now.
    if (!boundIp && !boundUa) {
      await pool.query('UPDATE session SET "ipAddress" = $1, "userAgent" = $2 WHERE id = $3', [
        currentIp,
        currentUa || null,
        session.session.id,
      ])
      return true
    }

    // User-Agent must match exactly — browsers don't change it spontaneously.
    if (boundUa && currentUa !== boundUa) {
      await killSession(session.session.id, 'user-agent mismatch')
      return false
    }
    // IP must match, or at least be in the same /24 (tolerates minor DHCP
    // rotations; a stealer attacker is on a completely different network).
    if (boundIp && currentIp !== 'unknown' && !sameSubnet24(boundIp, currentIp)) {
      await killSession(session.session.id, 'IP mismatch')
      return false
    }
    return true
  } catch {
    // Fail open on unexpected errors — don't lock out legit users on a bug.
    return true
  }
}

function sameSubnet24(a: string, b: string): boolean {
  if (a === b) return true
  const pa = a.split('.')
  const pb = b.split('.')
  if (pa.length === 4 && pb.length === 4) {
    return pa[0] === pb[0] && pa[1] === pb[1] && pa[2] === pb[2]
  }
  return false
}

async function killSession(sessionId: string, reason: string): Promise<void> {
  try {
    await pool.query('DELETE FROM session WHERE id = $1', [sessionId])
    const { reportError } = await import('@/lib/server-errors')
    void reportError('auth.session-binding-kill', new Error(`Session killed: ${reason}`))
  } catch {
    // best effort
  }
}

export type AdminUser = {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  permissions: string[]
  locale: Locale
}

export async function getAdminUser(): Promise<AdminUser | null> {
  try {
    return await getAdminUserInner()
  } catch (e) {
    console.error('[auth] getAdminUser failed:', (e as Error).message)
    return null
  }
}

async function getAdminUserInner(): Promise<AdminUser | null> {
  const auth = await getAuth()
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null

  // Anti-stealer: kill the session if IP/User-Agent don't match where it was created.
  const bound = await validateSessionBinding(
    session as { session: { id: string; ipAddress?: string | null; userAgent?: string | null } },
  )
  if (!bound) return null

  const u = session.user as unknown as {
    id: string
    name: string
    email: string
    role?: string
    is_active?: boolean
  }

  if (u.is_active === false) return null

  const roleCode = u.role ?? 'manager'
  // Storefront customers must never gain access to the admin center.
  if (roleCode === 'customer') return null
  const [roleRow] = await db.select().from(roles).where(eq(roles.code, roleCode)).limit(1)
  const permissions = (roleRow?.permissions as string[]) ?? []

  // Read the admin's chosen interface language straight from the DB rather
  // than trusting the Better Auth session payload: it's not refreshed after
  // the language switcher updates it, so a stale session would keep showing
  // the old language until the next sign-in. Same pattern as getShopUser().
  let locale: Locale = 'uk'
  try {
    const { rows } = await pool.query<{ locale: string | null }>(
      'SELECT locale FROM "user" WHERE id = $1',
      [u.id],
    )
    const raw = rows[0]?.locale
    // Admin default is 'uk', same as the storefront. Explicit 'ru' on the
    // user row still wins (language switcher).
    if (isLocale(raw)) locale = raw
  } catch {
    // Column may not exist yet on an un-migrated DB — fall back to 'uk'.
  }

  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: roleCode,
    isActive: true,
    permissions,
    locale,
  }
}

export type ShopUser = {
  id: string
  name: string
  email: string
  phone: string | null
}

// Returns the current logged-in storefront user (any role, including customer).
// Name and phone are read from the DB (authoritative) rather than the Better Auth
// session object, which is not refreshed after a profile edit — otherwise saved
// changes would not show up until the next sign-in.
export async function getShopUser(): Promise<ShopUser | null> {
  let session: Awaited<ReturnType<Awaited<ReturnType<typeof getAuth>>['api']['getSession']>> | null = null
  try {
    const auth = await getAuth()
    session = await auth.api.getSession({ headers: await headers() })
  } catch (e) {
    console.error('[auth] getShopUser session failed:', (e as Error).message)
    return null
  }
  if (!session?.user) return null
  const u = session.user as unknown as {
    id: string
    name: string
    email: string
    phone?: string | null
  }
  try {
    const { rows } = await pool.query<{ name: string | null; phone: string | null }>(
      `SELECT name, phone FROM "user" WHERE id = $1 LIMIT 1`,
      [u.id],
    )
    const row = rows[0]
    if (row) {
      return { id: u.id, name: row.name ?? u.name, email: u.email, phone: row.phone ?? null }
    }
  } catch {
    // Fall back to session values if the lookup fails.
  }
  return { id: u.id, name: u.name, email: u.email, phone: u.phone ?? null }
}

// Use in every protected page/layout. Redirects unauthenticated users to login.
// Users whose role has no admin permissions at all are not allowed into the
// admin center — they are sent back to the storefront.

export async function getStaffSessionId(): Promise<string | null> {
  try {
    const auth = await getAuth()
    const session = await auth.api.getSession({ headers: await headers() })
    const s = session?.session as { id?: string; token?: string } | undefined
    return s?.id || s?.token || null
  } catch {
    return null
  }
}

export async function staffTwoFactorSatisfied(userId: string): Promise<boolean> {
  let enabled = false
  try {
    const { rows } = await pool.query<{ two_factor_enabled: boolean }>(
      `SELECT two_factor_enabled FROM "user" WHERE id = $1`,
      [userId],
    )
    enabled = Boolean(rows[0]?.two_factor_enabled)
  } catch (e) {
    // Fail CLOSED: a DB error must not skip 2FA and let staff into admin.
    // Run db/migrate.sql (or scripts/db-setup.mjs) if the column is missing.
    console.error('[staff-2fa] could not read two_factor_enabled:', (e as Error).message)
    return false
  }
  if (!enabled) return true
  const sessionId = await getStaffSessionId()
  if (!sessionId) return false
  const jar = await cookies()
  const cookie = jar.get('staff_2fa')?.value
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) {
    // Production without BETTER_AUTH_SECRET must not accept a well-known
    // fallback HMAC key. Dev keeps a local-only default.
    if (process.env.NODE_ENV === 'production') return false
    return twoFactorCookieValid(userId, 'dev-staff-2fa', cookie, sessionId)
  }
  return twoFactorCookieValid(userId, secret, cookie, sessionId)
}

export async function requireAdmin(): Promise<AdminUser> {
  const user = await getAdminUser()
  // Guests (and storefront customers) must not land on the staff sign-in
  // form via /admin — that advertises the admin center. Staff who know
  // the URL still use /sign-in directly.
  if (!user) redirect('/')
  if (user.permissions.length === 0) redirect('/')
  if (!(await staffTwoFactorSatisfied(user.id))) redirect('/sign-in?2fa=1')
  return user
}

// Guard a page by permission. Shows the access-denied page if not allowed.
export async function requirePermission(key: PermissionKey): Promise<AdminUser> {
  const user = await requireAdmin()
  if (!hasPermission(user.permissions, key)) redirect('/admin/access-denied?key=' + key)
  return user
}

// Guard a server action or API route by permission. Throws instead of
// redirecting so mutations fail loudly when called without authorization.
export async function assertPermission(key: PermissionKey): Promise<AdminUser> {
  const user = await getAdminUser()
  if (!user) throw new Error('Не авторизовано')
  if (!(await staffTwoFactorSatisfied(user.id))) throw new Error('Потрібен код 2FA')
  if (!hasPermission(user.permissions, key)) throw new Error('Немає прав доступу: ' + key)
  return user
}

// Guard for admin-only API routes: returns the user or null (caller returns 401/403).
export async function getAdminUserWithPermission(key: PermissionKey): Promise<AdminUser | null> {
  const user = await getAdminUser()
  if (!user) return null
  if (!(await staffTwoFactorSatisfied(user.id))) return null
  if (!hasPermission(user.permissions, key)) return null
  return user
}

export async function getAdminUserWithWritePermission(key: PermissionKey): Promise<AdminUser | null> {
  const user = await getAdminUserWithPermission(key)
  if (!user || !canWrite(user.permissions, key)) return null
  return user
}

export async function assertWritePermission(key: PermissionKey): Promise<AdminUser> {
  const user = await assertPermission(key)
  if (!canWrite(user.permissions, key)) throw new Error('Немає прав на зміну: ' + key)
  return user
}
