import { describe, expect, it, vi, afterEach } from 'vitest'
import { fetchWithTimeout } from '@/lib/http'

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
  vi.restoreAllMocks()
})

describe('fetchWithTimeout', () => {
  it('passes through a successful response and uses AbortSignal.timeout', () => {
    const spy = vi.fn().mockResolvedValue(new Response('ok'))
    globalThis.fetch = spy
    return fetchWithTimeout('https://example.com', { timeoutMs: 5_000 }).then((res) => {
      expect(res.status).toBe(200)
      const init = spy.mock.calls[0][1] as RequestInit
      expect(init.signal).toBeInstanceOf(AbortSignal)
    })
  })

  it('throws a labeled error on timeout', async () => {
    const err = new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    globalThis.fetch = vi.fn().mockRejectedValue(err)
    await expect(
      fetchWithTimeout('https://example.com', { timeoutMs: 10, label: 'WayForPay API' }),
    ).rejects.toThrow('WayForPay API timed out after 10ms')
  })

  it('rethrows non-timeout errors unchanged', async () => {
    const boom = new Error('connection refused')
    globalThis.fetch = vi.fn().mockRejectedValue(boom)
    await expect(fetchWithTimeout('https://example.com', { timeoutMs: 10 })).rejects.toBe(boom)
  })
})
