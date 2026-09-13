import { NextResponse, type NextRequest } from 'next/server'
import { buildAllowedImageUrl } from '@/lib/api/safe-image-url'
import { clientIp, isRateLimited } from '@/lib/api/rate-limit'

/**
 * Same-origin image proxy for Prom.ua photos used in JSON-LD, Open Graph
 * and the Google Merchant feed. Emails keep using /api/email-image.
 *
 * SSRF: hostname is taken from a server-controlled allow-list of literals;
 * the raw `src` query never reaches fetch.
 */
export async function GET(req: NextRequest) {
  if (isRateLimited('media-image', clientIp(req), 120, 60_000)) {
    return new NextResponse('Too many requests', { status: 429 })
  }
  const src = req.nextUrl.searchParams.get('src')
  if (!src) return new NextResponse('Missing src', { status: 400 })

  const safeUrl = buildAllowedImageUrl(src)
  if (!safeUrl) return new NextResponse('Host not allowed', { status: 403 })

  try {
    const upstream = await fetch(safeUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; UniversalMagazineMedia/1.0)' },
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    })
    if (!upstream.ok) return new NextResponse('Upstream error', { status: 502 })

    const contentType = upstream.headers.get('content-type') ?? 'image/jpeg'
    if (!contentType.startsWith('image/')) {
      return new NextResponse('Not an image', { status: 415 })
    }

    return new NextResponse(upstream.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, immutable',
      },
    })
  } catch {
    return new NextResponse('Fetch failed', { status: 502 })
  }
}
