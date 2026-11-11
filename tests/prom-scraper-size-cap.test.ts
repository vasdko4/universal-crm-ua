import { describe, expect, it } from 'vitest'
import {
  MAX_SCRAPED_HTML_BYTES,
  PageTooLargeError,
  readCappedText,
} from '@/lib/prom-import/scraper'

const enc = new TextEncoder()

function streamedResponse(chunks: string[], contentLength?: string): Response {
  const bytes = chunks.map((c) => enc.encode(c))
  const headers = new Headers()
  if (contentLength != null) headers.set('content-length', contentLength)
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const b of bytes) controller.enqueue(b)
        controller.close()
      },
    }),
    { headers },
  )
}

describe('MAX_SCRAPED_HTML_BYTES', () => {
  it('is 5MB', () => {
    expect(MAX_SCRAPED_HTML_BYTES).toBe(5 * 1024 * 1024)
  })
})

describe('PageTooLargeError', () => {
  it('carries the url, byte count and a distinct message', () => {
    const err = new PageTooLargeError('https://prom.ua/x', 123)
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('PageTooLargeError')
    expect(err.url).toBe('https://prom.ua/x')
    expect(err.bytes).toBe(123)
    expect(err.message).toContain('too large')
    expect(err.message).toContain('https://prom.ua/x')
  })
})

describe('readCappedText', () => {
  it('returns the joined text for pages under the cap', async () => {
    const res = streamedResponse(['<htm', 'l>ok</html>'])
    await expect(readCappedText(res, 'https://prom.ua/x', 100)).resolves.toBe('<html>ok</html>')
  })

  it('decodes multi-byte characters split across chunks', async () => {
    // 'привіт' split in the middle of a Cyrillic code point: a naive
    // per-chunk decode would produce replacement characters.
    const full = enc.encode('привіт')
    const a = full.slice(0, 3)
    const b = full.slice(3)
    const res = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(a)
          controller.enqueue(b)
          controller.close()
        },
      }),
    )
    await expect(readCappedText(res, 'https://prom.ua/x', 100)).resolves.toBe('привіт')
  })

  it('refuses up front when Content-Length exceeds the cap', async () => {
    const res = streamedResponse(['tiny'], String(MAX_SCRAPED_HTML_BYTES + 1))
    const err = await readCappedText(res, 'https://prom.ua/big').catch((e) => e)
    expect(err).toBeInstanceOf(PageTooLargeError)
    expect((err as PageTooLargeError).bytes).toBe(MAX_SCRAPED_HTML_BYTES + 1)
    expect((err as Error).message).toContain('too large')
  })

  it('aborts mid-stream when the body exceeds the cap despite a small Content-Length', async () => {
    const res = streamedResponse(['0123456789', '0123456789'], '20')
    const err = await readCappedText(res, 'https://prom.ua/liar', 15).catch((e) => e)
    expect(err).toBeInstanceOf(PageTooLargeError)
    expect((err as PageTooLargeError).bytes).toBe(20)
  })

  it('aborts mid-stream when Content-Length is missing', async () => {
    const res = streamedResponse(['0123456789', '0123456789'])
    await expect(readCappedText(res, 'https://prom.ua/no-length', 15)).rejects.toThrow(
      PageTooLargeError,
    )
  })

  it('allows a page of exactly the cap', async () => {
    const res = streamedResponse(['0123456789'])
    await expect(readCappedText(res, 'https://prom.ua/exact', 10)).resolves.toBe('0123456789')
  })

  it('falls back to res.text() when there is no body', async () => {
    const res = new Response(null)
    await expect(readCappedText(res, 'https://prom.ua/empty', 10)).resolves.toBe('')
  })
})
