import { describe, it, expect, vi, beforeEach } from 'vitest'

// lib/session pulls in Next boundary modules at import time — stub them, and
// stub auth + DB so getShopUser is exercised against fake data, not a live
// session or database.
vi.mock('next/cache', () => ({
  unstable_cache: (fn: unknown) => fn,
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))
vi.mock('next/headers', () => ({ cookies: vi.fn(), headers: vi.fn(async () => new Headers()) }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getAuth: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: {}, pool: { query: vi.fn() } }))

import { getAuth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getShopUser } from '@/lib/session'

const mockedGetAuth = vi.mocked(getAuth)
const mockedPoolQuery = vi.mocked(pool.query)
const mockGetSession = vi.fn()

type UserRow = { name: string | null; phone: string | null; is_active?: boolean | null }

let userRow: UserRow | null = { name: 'DB Name', phone: '+380679999999', is_active: true }

function sessionFor(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      id: 'user-1',
      name: 'Session Name',
      email: 'user@example.com',
      phone: '+380671111111',
      is_active: true,
      ...overrides,
    },
    session: { id: 'sess-1' },
  }
}

describe('getShopUser — deactivated users are locked out (3.4.107 fix 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    userRow = { name: 'DB Name', phone: '+380679999999', is_active: true }
    mockGetSession.mockResolvedValue(sessionFor())
    mockedGetAuth.mockResolvedValue({ api: { getSession: mockGetSession } } as never)
    mockedPoolQuery.mockImplementation(async (sql: string) => {
      // Session binding is disabled in these tests so the binding check
      // returns before touching headers/IPs.
      if (String(sql).includes('store_settings')) {
        return { rows: [{ session_binding_enabled: false }] } as never
      }
      if (String(sql).includes('FROM "user"')) {
        return { rows: userRow ? [userRow] : [] } as never
      }
      return { rows: [] } as never
    })
  })

  it('active user is returned with the DB name and phone', async () => {
    const user = await getShopUser()
    expect(user).toEqual({
      id: 'user-1',
      name: 'DB Name',
      email: 'user@example.com',
      phone: '+380679999999',
    })
    // The DB lookup must ask for is_active — that is what enforces the lockout.
    const userQuery = mockedPoolQuery.mock.calls.find(([sql]) =>
      String(sql).includes('FROM "user"'),
    )
    expect(String(userQuery?.[0])).toContain('is_active')
  })

  it('deactivated user (DB is_active false) gets null', async () => {
    userRow = { name: 'DB Name', phone: '+380679999999', is_active: false }
    await expect(getShopUser()).resolves.toBeNull()
  })

  it('deactivated session payload (is_active false) gets null even if the DB row says active', async () => {
    mockGetSession.mockResolvedValue(sessionFor({ is_active: false }))
    await expect(getShopUser()).resolves.toBeNull()
  })

  it('no session returns null', async () => {
    mockGetSession.mockResolvedValue(null)
    await expect(getShopUser()).resolves.toBeNull()
  })

  it('missing DB row falls back to session values', async () => {
    userRow = null
    const user = await getShopUser()
    expect(user).toEqual({
      id: 'user-1',
      name: 'Session Name',
      email: 'user@example.com',
      phone: '+380671111111',
    })
  })

  it('a row without is_active is treated as active (strict === false check)', async () => {
    userRow = { name: 'DB Name', phone: '+380679999999' }
    const user = await getShopUser()
    expect(user).toEqual({
      id: 'user-1',
      name: 'DB Name',
      email: 'user@example.com',
      phone: '+380679999999',
    })
  })
})
