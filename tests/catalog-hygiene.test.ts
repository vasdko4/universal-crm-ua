import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({ pool: { connect: vi.fn() } }))

import { pool } from '@/lib/db'

const mockedConnect = vi.mocked(pool.connect)

function deadlockError(): Error & { code: string } {
  const err = new Error('deadlock detected') as Error & { code: string }
  err.code = '40P01'
  return err
}

function makeClient(impl: (sql: string, params?: unknown[]) => unknown) {
  return {
    query: vi.fn(async (sql: string, params?: unknown[]) => impl(sql, params)),
    release: vi.fn(),
  }
}

type Client = ReturnType<typeof makeClient>

describe('runCatalogHygiene', () => {
  beforeEach(() => {
    vi.resetModules()
    mockedConnect.mockReset()
  })

  async function runWith(client: Client) {
    mockedConnect.mockResolvedValue(client as never)
    const { runCatalogHygiene } = await import('@/lib/shop/catalog-hygiene')
    return runCatalogHygiene()
  }

  function lockAndCount(clientImpl: (sql: string) => unknown) {
    return makeClient((sql) => {
      if (sql.includes('pg_try_advisory_lock')) return { rows: [{ ok: true }] }
      if (sql.includes('count(*)')) return { rows: [{ n: '0' }] }
      return clientImpl(sql)
    })
  }

  it('skips the cleanup when another instance holds the advisory lock', async () => {
    const client = makeClient((sql) =>
      sql.includes('pg_try_advisory_lock') ? { rows: [{ ok: false }] } : { rows: [] },
    )
    await runWith(client)
    // Only the lock attempt ran — no cleanup statements, but the client is released.
    expect(client.query).toHaveBeenCalledTimes(1)
    expect(client.release).toHaveBeenCalledTimes(1)
  })

  it('runs the cleanup, then unlocks and releases the client', async () => {
    const client = lockAndCount(() => ({ rows: [] }))
    await runWith(client)
    // lock + count + 7 statements + unlock
    expect(client.query.mock.calls.length).toBeGreaterThan(3)
    const unlocks = client.query.mock.calls.filter(([sql]) =>
      String(sql).includes('pg_advisory_unlock'),
    )
    expect(unlocks).toHaveLength(1)
    expect(client.release).toHaveBeenCalledTimes(1)
  })

  it('retries on deadlock and succeeds', async () => {
    let attempts = 0
    const client = makeClient((sql) => {
      if (sql.includes('pg_try_advisory_lock')) return { rows: [{ ok: true }] }
      if (sql.includes('count(*)')) {
        attempts += 1
        if (attempts === 1) throw deadlockError()
        return { rows: [{ n: '0' }] }
      }
      return { rows: [] }
    })
    await runWith(client)
    expect(attempts).toBe(2)
    expect(client.release).toHaveBeenCalledTimes(1)
  })

  it('gives up after 3 deadlock attempts, then unlocks, releases and rethrows', async () => {
    const client = makeClient((sql) => {
      if (sql.includes('pg_try_advisory_lock')) return { rows: [{ ok: true }] }
      if (sql.includes('pg_advisory_unlock')) return { rows: [] }
      throw deadlockError()
    })
    await expect(runWith(client)).rejects.toThrow('deadlock detected')
    const unlocks = client.query.mock.calls.filter(([sql]) =>
      String(sql).includes('pg_advisory_unlock'),
    )
    expect(unlocks).toHaveLength(1)
    expect(client.release).toHaveBeenCalledTimes(1)
  })

  it('does not retry non-deadlock errors', async () => {
    let calls = 0
    const client = makeClient((sql) => {
      if (sql.includes('pg_try_advisory_lock')) return { rows: [{ ok: true }] }
      if (sql.includes('pg_advisory_unlock')) return { rows: [] }
      calls += 1
      throw new Error('connection reset')
    })
    await expect(runWith(client)).rejects.toThrow('connection reset')
    expect(calls).toBe(1)
    expect(client.release).toHaveBeenCalledTimes(1)
  })

  it('retries pool.connect() on transient connection timeout, then runs', async () => {
    const timeoutError = () =>
      Object.assign(new Error('Connection terminated due to connection timeout'), {
        code: 'ECONNREFUSED',
      })
    const client = lockAndCount(() => ({ rows: [] }))
    mockedConnect
      .mockRejectedValueOnce(timeoutError())
      .mockRejectedValueOnce(timeoutError())
      .mockResolvedValue(client as never)
    const { runCatalogHygiene } = await import('@/lib/shop/catalog-hygiene')
    await runCatalogHygiene()
    expect(mockedConnect).toHaveBeenCalledTimes(3)
    expect(client.release).toHaveBeenCalledTimes(1)
  })

  it('gives up pool.connect() after 3 transient failures', async () => {
    mockedConnect.mockRejectedValue(
      Object.assign(new Error('Connection terminated due to connection timeout'), {
        code: 'ECONNREFUSED',
      }),
    )
    const { runCatalogHygiene } = await import('@/lib/shop/catalog-hygiene')
    await expect(runCatalogHygiene()).rejects.toThrow(
      'Connection terminated due to connection timeout',
    )
    expect(mockedConnect).toHaveBeenCalledTimes(3)
  })

  it('does not retry pool.connect() on non-transient errors', async () => {
    mockedConnect.mockRejectedValue(
      Object.assign(new Error('password authentication failed'), { code: '28P01' }),
    )
    const { runCatalogHygiene } = await import('@/lib/shop/catalog-hygiene')
    await expect(runCatalogHygiene()).rejects.toThrow('password authentication failed')
    expect(mockedConnect).toHaveBeenCalledTimes(1)
  })
})
