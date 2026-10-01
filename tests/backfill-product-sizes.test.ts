import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/server', () => ({ after: vi.fn() }))
vi.mock('@/lib/db', () => ({ pool: { query: vi.fn() } }))
vi.mock('@/lib/shop/cache', () => ({ revalidateStorefront: vi.fn() }))

import { after } from 'next/server'
import { pool } from '@/lib/db'
import { revalidateStorefront } from '@/lib/shop/cache'

const mockedAfter = vi.mocked(after)
const mockedQuery = vi.mocked(pool.query)
const mockedRevalidate = vi.mocked(revalidateStorefront)

describe('ensureProductSizesBackfill', () => {
  beforeEach(async () => {
    vi.resetModules()
    mockedAfter.mockReset()
    mockedQuery.mockReset().mockResolvedValue({} as never)
    mockedRevalidate.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('runs the backfill SQL once even with concurrent callers', async () => {
    mockedAfter.mockImplementation((cb: () => void) => cb())
    const { ensureProductSizesBackfill } = await import('@/lib/shop/backfill-product-sizes')
    await Promise.all([ensureProductSizesBackfill(), ensureProductSizesBackfill()])
    expect(mockedQuery).toHaveBeenCalledTimes(1)
    expect(String(mockedQuery.mock.calls[0][0])).toContain('UPDATE products p')
    expect(mockedAfter).toHaveBeenCalledTimes(1)
    expect(mockedRevalidate).toHaveBeenCalledTimes(1)
  })

  it('defers revalidation with after() instead of calling it during render', async () => {
    let deferred: (() => void) | null = null
    mockedAfter.mockImplementation((cb: () => void) => {
      deferred = cb
    })
    const { ensureProductSizesBackfill } = await import('@/lib/shop/backfill-product-sizes')
    await ensureProductSizesBackfill()
    // revalidateTag during render is unsupported in Next.js — it must only
    // happen inside after(), i.e. after the response is sent.
    expect(mockedRevalidate).not.toHaveBeenCalled()
    expect(deferred).not.toBeNull()
    deferred!()
    expect(mockedRevalidate).toHaveBeenCalledTimes(1)
  })

  it('logs instead of throwing when the backfill query fails', async () => {
    const errSpy = vi.spyOn(console, 'error')
    mockedQuery.mockRejectedValueOnce(new Error('db down'))
    const { ensureProductSizesBackfill } = await import('@/lib/shop/backfill-product-sizes')
    await expect(ensureProductSizesBackfill()).resolves.toBeUndefined()
    expect(errSpy).toHaveBeenCalledWith('[backfill-product-sizes]', 'db down')
    expect(mockedAfter).not.toHaveBeenCalled()
  })
})
