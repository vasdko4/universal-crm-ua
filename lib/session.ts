import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { getAuth } from '@/lib/auth'
import { db, pool } from '@/lib/db'
import { roles } from '@/lib/db/schema'
import { hasPermission, type PermissionKey } from '@/lib/permissions'

export type AdminUser = {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  permissions: string[]
}

export async function getAdminUser(): Promise<AdminUser | null> {
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

  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: roleCode,
    isActive: true,
    permissions,
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
  const auth = await getAuth()
  const session = await auth.api.getSession({ headers: await headers() })
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
export async function requireAdmin(): Promise<AdminUser> {
  const user = await getAdminUser()
  if (!user) redirect('/sign-in')
  if (user.permissions.length === 0) redirect('/')
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
