import { NextResponse, type NextRequest } from 'next/server'
import { fetchAllowedImage } from '@/lib/api/proxy-image'
import { clientIp, isRateLimitedMemory } from '@/lib/api/rate-limit'

/**
 * Same-origin image proxy for Prom.ua photos used in JSON-LD, Open Graph
 * and the Google Merchant feed. Emails keep using /api/email-image.
 *
 * SSRF: hostname is taken from a server-controlled allow-list of literals;
 * the raw `src` query never reaches fetch.
 */
export async function GET(req: NextRequest) {
  if (isRateLimitedMemory('media-image', clientIp(req), 6000, 60_000)) {
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
