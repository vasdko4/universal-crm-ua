import { NextResponse, type NextRequest } from 'next/server'

// Hosts we are willing to proxy images from (product catalogs + our own blob).
const ALLOWED_HOSTS = new Set([
  'images.prom.ua',
  'hebbkx1anhila5yf.public.blob.vercel-storage.com',
])

/**
 * Image proxy for transactional emails.
 *
 * Product images live on external hosts (e.g. images.prom.ua) that reject
 * requests from email-client image proxies (Gmail/googleusercontent), so the
 * pictures show up broken in the inbox. This route fetches the image
 * server-side and serves it from our own domain, which email proxies accept.
 */
export async function GET(req: NextRequest) {
  const src = req.nextUrl.searchParams.get('src')
  if (!src) return new NextResponse('Missing src', { status: 400 })

  let url: URL
  try {
    url = new URL(src)
  } catch {
    return new NextResponse('Bad src', { status: 400 })
  }
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) {
    return new NextResponse('Host not allowed', { status: 403 })
  }

  try {
    const upstream = await fetch(url.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PowerFoxMailer/1.0)' },
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
        // Long-lived cache: product photos are immutable for a given URL.
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, immutable',
      },
    })
  } catch {
    return new NextResponse('Fetch failed', { status: 502 })
  }
}
