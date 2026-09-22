import { NextResponse, type NextRequest } from 'next/server'
import { fetchAllowedImage } from '@/lib/api/proxy-image'
import { clientIp, isRateLimitedMemory } from '@/lib/api/rate-limit'

/**
 * Image proxy for transactional emails.
 *
 * Product images live on external hosts (e.g. images.prom.ua) that reject
 * requests from email-client image proxies (Gmail/googleusercontent), so the
 * pictures show up broken in the inbox. This route fetches the image
 * server-side and serves it from our own domain, which email proxies accept.
 *
 * SSRF: hostname is taken from a server-controlled allow-list of literals;
 * each redirect hop is rebuilt through the same allow-list.
 */
export async function GET(req: NextRequest) {
  if (isRateLimitedMemory('email-image', clientIp(req), 120, 60_000)) {
    return new NextResponse('Too many requests', { status: 429 })
  }
  const src = req.nextUrl.searchParams.get('src')
  if (!src) return new NextResponse('Missing src', { status: 400 })

  const result = await fetchAllowedImage(src)
  if (!result.ok) return new NextResponse(result.message, { status: result.status })

  return new NextResponse(result.body, {
    headers: {
      'Content-Type': result.contentType,
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, immutable',
    },
  })
}
