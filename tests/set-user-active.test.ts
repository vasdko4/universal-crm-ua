import { describe, it, expect, vi, beforeEach } from 'vitest'

// app/actions/users.ts is a server action module: stub the Next boundary and
// every lib it touches so the tests exercise setUserActive itself, against a
// fake pool, instead of a live DB or auth session.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getAuth: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: {}, pool: { query: vi.fn() } }))
vi.mock('@/lib/session', () => ({
  getAdminUser: vi.fn(),
  staffTwoFactorSatisfied: vi.fn(),
}))
vi.mock('@/lib/audit-log', () => ({
  auditLog: vi.fn(),
  fillAuditTemplate: (template: string) => template,
}))
vi.mock('@/lib/i18n/admin/dictionaries', () => ({
  getAdminDictionary: () => ({
    users: {
      insufficientRights: 'insufficient-rights',
      twoFactorRequired: '2fa-required',
      userNotFound: 'user-not-found',
      cannotDeactivateSelf: 'cannot-deactivate-self',
      cannotDeleteSelf: 'cannot-delete-self',
      deleteFailed: 'delete-failed',
      createFailed: 'create-failed',
      unknownRole: 'unknown-role',
      cannotDemoteSelf: 'cannot-demote-self',
      roleSaveFailed: 'role-save-failed',
      cannotDeleteSystemRole: 'cannot-delete-system-role',
      roleInUse: 'role-in-use',
    },
    auditLog: {
      userActivated: 'user-activated',
      userDeactivated: 'user-deactivated',
      userCreated: 'user-created',
      userRoleChanged: 'user-role-changed',
      userDeleted: 'user-deleted',
    },
  }),
}))
vi.mock('@/lib/i18n/server', () => ({ getLocale: vi.fn(async () => 'uk') }))
vi.mock('@/lib/server-errors', () => ({ reportError: vi.fn() }))

import { revalidatePath } from 'next/cache'
import { pool } from '@/lib/db'
import { getAdminUser, staffTwoFactorSatisfied } from '@/lib/session'
import { auditLog } from '@/lib/audit-log'
import { setUserActive } from '@/app/actions/users'

const mockedPoolQuery = vi.mocked(pool.query)
const mockedGetAdminUser = vi.mocked(getAdminUser)
const mockedTwoFactor = vi.mocked(staffTwoFactorSatisfied)
const mockedAuditLog = vi.mocked(auditLog)
const mockedRevalidatePath = vi.mocked(revalidatePath)

const ADMIN = {
  id: 'admin-1',
  name: 'Admin',
  email: 'admin@example.com',
  role: 'admin',
  isActive: true,
  permissions: ['*'],
  locale: 'uk' as const,
}

function sessionDeleteCalls() {
  return mockedPoolQuery.mock.calls.filter(([sql]) =>
    String(sql).includes('DELETE FROM session'),
  )
}

function updateCalls() {
  return mockedPoolQuery.mock.calls.filter(([sql]) =>
    String(sql).includes('UPDATE "user" SET is_active'),
  )
}

describe('setUserActive — deactivation revokes sessions (3.4.107 fix 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedGetAdminUser.mockResolvedValue(ADMIN)
    mockedTwoFactor.mockResolvedValue(true)
    mockedPoolQuery.mockImplementation(async (sql: string) => {
      if (String(sql).includes('UPDATE "user" SET is_active')) return { rowCount: 1 } as never
      if (String(sql).includes('DELETE FROM session')) return { rowCount: 2 } as never
      return { rowCount: 0, rows: [] } as never
    })
  })

  it('deactivating a user deletes all of their sessions', async () => {
    const res = await setUserActive('user-1', false)
    expect(res).toEqual({ success: true })
    expect(updateCalls()).toHaveLength(1)
    expect(updateCalls()[0][1]).toEqual([false, 'user-1'])
    expect(sessionDeleteCalls()).toHaveLength(1)
    expect(sessionDeleteCalls()[0]).toEqual([
      'DELETE FROM session WHERE "userId" = $1',
      ['user-1'],
    ])
    // The flag flip lands before the session delete.
    expect(mockedPoolQuery.mock.invocationCallOrder[0]).toBeLessThan(
      mockedPoolQuery.mock.invocationCallOrder[1],
    )
  })

  it('reactivating a user does not touch sessions', async () => {
    const res = await setUserActive('user-1', true)
    expect(res).toEqual({ success: true })
    expect(updateCalls()).toHaveLength(1)
    expect(updateCalls()[0][1]).toEqual([true, 'user-1'])
    expect(sessionDeleteCalls()).toHaveLength(0)
  })

  it('an admin cannot deactivate themselves, and nothing is deleted', async () => {
    const res = await setUserActive('admin-1', false)
    expect(res).toEqual({ success: false, error: 'cannot-deactivate-self' })
    expect(mockedPoolQuery).not.toHaveBeenCalled()
  })

  it('an unknown user id reports not-found and deletes no sessions', async () => {
    mockedPoolQuery.mockImplementation(async (sql: string) => {
      if (String(sql).includes('UPDATE "user" SET is_active')) return { rowCount: 0 } as never
      return { rowCount: 0, rows: [] } as never
    })
    const res = await setUserActive('user-1', false)
    expect(res).toEqual({ success: false, error: 'user-not-found' })
    expect(sessionDeleteCalls()).toHaveLength(0)
  })

  it('deactivation is audit-logged as a security event', async () => {
    const res = await setUserActive('user-1', false)
    expect(res).toEqual({ success: true })
    expect(mockedAuditLog).toHaveBeenCalledTimes(1)
    expect(mockedAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'security',
        entity: 'user',
        entityId: 'user-1',
        details: 'user-deactivated',
      }),
    )
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/admin/users')
  })
})
