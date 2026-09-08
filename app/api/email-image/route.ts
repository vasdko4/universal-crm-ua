import { NextResponse, type NextRequest } from 'next/server'
import { parseAllowedImageUrl } from '@/lib/api/safe-image-url'
import { clientIp, isRateLimited } from '@/lib/api/rate-limit'

/**
 * Image proxy for transactional emails.
 *
 * Product images live on external hosts (e.g. images.prom.ua) that reject
 * requests from email-client image proxies (Gmail/googleusercontent), so the
 * pictures show up broken in the inbox. This route fetches the image
 * server-side and serves it from our own domain, which email proxies accept.
 *
 * SSRF: `src` is rebuilt from an allowlisted hostname (see parseAllowedImageUrl)
 * and fetch does not follow redirects.
 */
export async function GET(req: NextRequest) {
  if (isRateLimited('email-image', clientIp(req), 60, 60_000)) {
    return new NextResponse('Too many requests', { status: 429 })
  }
  const src = req.nextUrl.searchParams.get('src')
  if (!src) return new NextResponse('Missing src', { status: 400 })

  const url = parseAllowedImageUrl(src)
  if (!url) return new NextResponse('Host not allowed', { status: 403 })

  try {
    const upstream = await fetch(url.href, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; UniversalMagazineMailer/1.0)' },
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
