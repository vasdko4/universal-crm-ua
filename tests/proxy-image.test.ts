import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchAllowedImage } from '@/lib/api/proxy-image'

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01])

function jsonHeaders(h: Record<string, string>) {
  return new Headers(h)
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('fetchAllowedImage', () => {
  it('rejects unknown hosts before fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const result = await fetchAllowedImage('https://evil.example/x.jpg')
    expect(result).toEqual({ ok: false, status: 403, message: 'Host not allowed' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('serves a JPEG even when upstream lies about Content-Type', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JPEG, {
          status: 200,
          headers: jsonHeaders({ 'content-type': 'application/octet-stream' }),
        }),
      ),
    )
    const result = await fetchAllowedImage('https://images.prom.ua/a.jpg')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.contentType).toBe('image/jpeg')
  })

  it('follows an allow-listed redirect and refuses one off the list', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: jsonHeaders({ location: 'https://cdn.prom.st/b.jpg' }),
        }),
      )
      .mockResolvedValueOnce(
        new Response(JPEG, {
          status: 200,
          headers: jsonHeaders({ 'content-type': 'image/jpeg' }),
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const ok = await fetchAllowedImage('https://images.prom.ua/a.jpg')
    expect(ok.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[1][0])).toBe('https://cdn.prom.st/b.jpg')

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(null, {
          status: 302,
          headers: jsonHeaders({ location: 'https://evil.example/x.jpg' }),
        }),
      ),
    )
    const blocked = await fetchAllowedImage('https://images.prom.ua/a.jpg')
    expect(blocked).toEqual({ ok: false, status: 502, message: 'Upstream error' })
  })
})
