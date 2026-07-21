'use server'

import { revalidatePath } from 'next/cache'
import { asc, eq, sql } from 'drizzle-orm'
import { getAuth } from '@/lib/auth'
import { db, pool } from '@/lib/db'
import { roles } from '@/lib/db/schema'
import { getAdminUser } from '@/lib/session'
import { auditLog } from '@/lib/audit-log'

export async function countUsers(): Promise<number> {
  const res = await pool.query('SELECT COUNT(*)::int AS c FROM "user"')
  return res.rows[0]?.c ?? 0
}

// Bootstrap: allowed only when there are zero users. Creates the first admin.
export async function bootstrapAdmin(input: {
  name: string
  email: string
  password: string
}) {
  const total = await countUsers()
  if (total > 0) return { success: false, error: 'Администратор уже существует' }

  try {
    const auth = await getAuth()
    await auth.api.signUpEmail({
      body: { name: input.name, email: input.email, password: input.password },
    })
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Ошибка создания' }
  }
  // Promote to admin.
  await pool.query(`UPDATE "user" SET role = 'admin' WHERE email = $1`, [input.email])
  revalidatePath('/admin/users')
  return { success: true }
}

export type AdminUserRow = {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  createdAt: string | null
}

export async function listUsers(): Promise<AdminUserRow[]> {
  const me = await getAdminUser()
  if (!me || !me.permissions.includes('*')) return []
  const res = await pool.query(
    `SELECT id, name, email, role, is_active, "createdAt" FROM "user" ORDER BY "createdAt" ASC`,
  )
  return res.rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    isActive: r.is_active,
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
  }))
}

async function requireAdminGuard() {
  const me = await getAdminUser()
  if (!me || !me.permissions.includes('*')) {
    throw new Error('Недостаточно прав')
  }
  return me
}

export async function createUser(input: {
  name: string
  email: string
  password: string
  role: string
}) {
  const me = await requireAdminGuard()
  // Create the account via email sign-up, then assign the chosen role directly.
  try {
    const auth = await getAuth()
    await auth.api.signUpEmail({
      body: { name: input.name, email: input.email, password: input.password },
    })
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Ошибка создания' }
  }
  await pool.query(`UPDATE "user" SET role = $1 WHERE email = $2`, [input.role, input.email])
  void auditLog({
    userId: me.id, userName: me.name, userEmail: me.email,
    action: 'create', entity: 'user',
    details: `Создан пользователь ${input.email} (роль: ${input.role})`,
  })
  revalidatePath('/admin/users')
  return { success: true }
}

export async function updateUserRole(userId: string, role: string) {
  const me = await requireAdminGuard()
  if (me.id === userId) {
    // Prevent a super-admin from locking themselves (and everyone else) out
    // of user management by changing their own role to one without '*'.
    const [newRole] = await db.select().from(roles).where(eq(roles.code, role)).limit(1)
    const newPermissions = (newRole?.permissions as string[] | null) ?? []
    if (!newPermissions.includes('*')) {
      return { success: false, error: 'Нельзя лишить самого себя прав администратора' }
    }
  }
  await pool.query(`UPDATE "user" SET role = $1, "updatedAt" = NOW() WHERE id = $2`, [role, userId])
  void auditLog({
    userId: me.id, userName: me.name, userEmail: me.email,
    action: 'security', entity: 'user', entityId: userId,
    details: `Смена роли пользователя на «${role}»`,
  })
  revalidatePath('/admin/users')
  return { success: true }
}

export async function setUserActive(userId: string, isActive: boolean) {
  const me = await requireAdminGuard()
  if (me.id === userId && !isActive) {
    return { success: false, error: 'Нельзя деактивировать самого себя' }
  }
  await pool.query(`UPDATE "user" SET is_active = $1, "updatedAt" = NOW() WHERE id = $2`, [
    isActive,
    userId,
  ])
  void auditLog({
    userId: me.id, userName: me.name, userEmail: me.email,
    action: 'security', entity: 'user', entityId: userId,
    details: isActive ? 'Пользователь активирован' : 'Пользователь деактивирован',
  })
  revalidatePath('/admin/users')
  return { success: true }
}

export async function deleteUser(userId: string) {
  const me = await requireAdminGuard()
  if (me.id === userId) return { success: false, error: 'Нельзя удалить самого себя' }
  await pool.query(`DELETE FROM "user" WHERE id = $1`, [userId])
  void auditLog({
    userId: me.id, userName: me.name, userEmail: me.email,
    action: 'delete', entity: 'user', entityId: userId,
    details: 'Пользователь удалён',
  })
  revalidatePath('/admin/users')
  return { success: true }
}

// Roles CRUD
export async function listRoles() {
  // Matches the hard '*'-only gate on every other function in this file
  // (createUser/updateUserRole/saveRole/etc. all use requireAdminGuard) —
  // was the only reader in this file with no check at all, reachable
  // directly as a server action regardless of the /admin/users page guard.
  await requireAdminGuard()
  return db.select().from(roles).orderBy(asc(roles.id))
}

export async function saveRole(input: {
  id?: number
  code: string
  name: string
  description?: string
  permissions: string[]
}) {
  await requireAdminGuard()
  try {
  if (input.id) {
    const [existing] = await db.select().from(roles).where(eq(roles.id, input.id)).limit(1)
    if (existing?.isSystem && existing.code === 'admin') {
      // keep admin permissions as '*'
      await db
        .update(roles)
        .set({ name: input.name, description: input.description, updatedAt: new Date() })
        .where(eq(roles.id, input.id))
    } else {
      await db
        .update(roles)
        .set({
          name: input.name,
          description: input.description,
          permissions: input.permissions,
          updatedAt: new Date(),
        })
        .where(eq(roles.id, input.id))
    }
  } else {
    await db.insert(roles).values({
      code: input.code,
      name: input.name,
      description: input.description,
      permissions: input.permissions,
      isSystem: false,
    })
  }
  revalidatePath('/admin/users')
  return { success: true as const, error: undefined as string | undefined }
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : 'Ошибка сохранения роли' }
  }
}

export async function deleteRole(id: number) {
  await requireAdminGuard()
  const [existing] = await db.select().from(roles).where(eq(roles.id, id)).limit(1)
  if (existing?.isSystem) return { success: false, error: 'Системную роль нельзя удалить' }
  const inUse = await pool.query(`SELECT COUNT(*)::int AS c FROM "user" WHERE role = $1`, [
    existing?.code,
  ])
  if ((inUse.rows[0]?.c ?? 0) > 0) {
    return { success: false, error: 'Роль назначена пользователям' }
  }
  await db.delete(roles).where(eq(roles.id, id))
  revalidatePath('/admin/users')
  return { success: true }
}
