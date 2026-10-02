import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/db', () => ({ pool: { query: vi.fn() } }))
vi.mock('@/lib/server-errors', () => ({
  reportError: vi.fn().mockResolvedValue(undefined),
}))

import { pool } from '@/lib/db'
import { reportError } from '@/lib/server-errors'
import { recordStockMovement } from '@/lib/shop/stock-ledger'

const mockedQuery = vi.mocked(pool.query)
const mockedReport = vi.mocked(reportError)

const input = {
  productId: 7,
  delta: -1,
  quantityAfter: 4,
  reason: 'sale' as const,
  orderId: 123,
}

describe('recordStockMovement', () => {
  beforeEach(() => {
    mockedQuery.mockReset().mockResolvedValue({} as never)
    mockedReport.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('writes the ledger row without reporting', async () => {
    await recordStockMovement(input)
    expect(mockedQuery).toHaveBeenCalledTimes(1)
    expect(String(mockedQuery.mock.calls[0][0])).toContain('INSERT INTO stock_movements')
    expect(mockedReport).not.toHaveBeenCalled()
  })

  it('reports the failure without throwing when the write fails', async () => {
    mockedQuery.mockRejectedValueOnce(new Error('db down'))
    await expect(recordStockMovement(input)).resolves.toBeUndefined()
    expect(mockedReport).toHaveBeenCalledTimes(1)
    const [tag, err, opts] = mockedReport.mock.calls[0]
    expect(tag).toBe('stock.ledger-write-failed')
    expect(err).toBeInstanceOf(Error)
    expect(opts).toBeUndefined()
  })
})
