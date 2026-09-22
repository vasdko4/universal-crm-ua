import { detectImageKind, mimeForImageKind } from '@/lib/api/image-kind'
import { buildAllowedImageUrl } from '@/lib/api/safe-image-url'

const MAX_BYTES = 8_000_000
const MAX_REDIRECTS = 3
const UA = 'Mozilla/5.0 (compatible; UniversalMagazineMedia/1.0)'

export type ProxyImageResult =
  | { ok: true; body: ArrayBuffer; contentType: string }
  | { ok: false; status: number; message: string }

/**
 * Fetch an allow-listed image for `/api/media` (and email).
 *
 * Prom CDN sometimes 302s or serves `application/octet-stream`. The old
 * proxy treated both as hard failures (`redirect: 'error'` / 415), which
 * Chrome logs as `media:1 Failed to load resource`.
 *
 * Location is never fetched raw — each hop is rebuilt through the SSRF
 * allow-list, same as the original `src`.
 */
export async function fetchAllowedImage(src: string): Promise<ProxyImageResult> {
  let current = buildAllowedImageUrl(src)
  if (!current) return { ok: false, status: 403, message: 'Host not allowed' }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let upstream: Response
    try {
      upstream = await fetch(current, {
        headers: {
          'User-Agent': UA,
          Accept: 'image/avif,image/webp,image/*,*/*;q=0.8',
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(10_000),
      })
    } catch {
      return { ok: false, status: 502, message: 'Fetch failed' }
    }

    if (upstream.status >= 300 && upstream.status < 400) {
      const location = upstream.headers.get('location')
      if (!location) return { ok: false, status: 502, message: 'Upstream error' }
      let nextHref: string
      try {
        nextHref = new URL(location, current).toString()
      } catch {
        return { ok: false, status: 502, message: 'Upstream error' }
      }
      const safe = buildAllowedImageUrl(nextHref)
      if (!safe) return { ok: false, status: 502, message: 'Upstream error' }
      current = safe
      continue
    }

    if (!upstream.ok) return { ok: false, status: 502, message: 'Upstream error' }

    const buf = new Uint8Array(await upstream.arrayBuffer())
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) {
      return { ok: false, status: 502, message: 'Upstream error' }
    }
    const kind = detectImageKind(buf)
    if (!kind) return { ok: false, status: 415, message: 'Not an image' }
    const body = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    return { ok: true, body, contentType: mimeForImageKind(kind) }
  }

  return { ok: false, status: 502, message: 'Upstream error' }
}
