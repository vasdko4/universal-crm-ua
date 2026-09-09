import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { getAuth } from '@/lib/auth'
import { db, pool } from '@/lib/db'
import { roles } from '@/lib/db/schema'
import { canWrite, hasPermission, type PermissionKey } from '@/lib/permissions'
import { twoFactorCookieValid } from '@/lib/staff-2fa'
import type { Locale } from '@/lib/i18n/config'
import { isLocale } from '@/lib/i18n/config'

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
let twoFaColumnsReady: Promise<void> | null = null

/** Production DBs that never ran migrate.sql are missing these columns. */
export async function ensureStaffTwoFactorColumns(): Promise<void> {
  if (!twoFaColumnsReady) {
    // node-pg uses the extended protocol — one statement per query.
    twoFaColumnsReady = (async () => {
      try {
        await pool.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "two_factor_secret" varchar(64)`)
        await pool.query(
          `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "two_factor_enabled" boolean NOT NULL DEFAULT false`,
        )
        await pool.query(
          `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "two_factor_pending_secret" varchar(64)`,
        )
      } catch (e) {
        console.error('[staff-2fa] ensure columns failed:', (e as Error).message)
        twoFaColumnsReady = null
      }
    })()
  }
  await twoFaColumnsReady
}

export async function staffTwoFactorSatisfied(userId: string): Promise<boolean> {
  try {
    await ensureStaffTwoFactorColumns()
    const { rows } = await pool.query<{ two_factor_enabled: boolean }>(
      `SELECT two_factor_enabled FROM "user" WHERE id = $1`,
      [userId],
    )
    if (!rows[0]?.two_factor_enabled) return true
    const jar = await cookies()
    const cookie = jar.get('staff_2fa')?.value
    return twoFactorCookieValid(userId, process.env.BETTER_AUTH_SECRET || 'dev-staff-2fa', cookie)
  } catch {
    return true
  }
}

export async function requireAdmin(): Promise<AdminUser> {
  const user = await getAdminUser()
  if (!user) redirect('/sign-in')
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
  if (!hasPermission(user.permissions, key)) throw new Error('Нет прав доступа: ' + key)
  return user
}

// Guard for admin-only API routes: returns the user or null (caller returns 401/403).
export async function getAdminUserWithPermission(key: PermissionKey): Promise<AdminUser | null> {
  const user = await getAdminUser()
  if (!user) return null
  if (!hasPermission(user.permissions, key)) return null
  return user
}

export async function assertWritePermission(key: PermissionKey): Promise<AdminUser> {
  const user = await assertPermission(key)
  if (!canWrite(user.permissions, key)) throw new Error('Немає прав на зміну: ' + key)
  return user
}
