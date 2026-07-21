import { NextResponse, type NextRequest } from 'next/server'
import { trackEvent } from '@/app/actions/analytics'

export const dynamic = 'force-dynamic'

// Naive in-memory rate limiter: max N events per IP per minute. Good enough to
// stop casual flooding of the analytics table without extra infrastructure.
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 60
const hits = new Map<string, { count: number; resetAt: number }>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = hits.get(ip)
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    // Opportunistic cleanup so the map never grows unbounded.
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k)
    }
    return false
  }
  entry.count++
  return entry.count > MAX_PER_WINDOW
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  if (rateLimited(ip)) {
    return NextResponse.json({ success: false, error: 'Too many events' }, { status: 429 })
  }

  let body: {
    type?: string
    path?: string
    productId?: number
    sessionId?: string
    referrer?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Bad JSON' }, { status: 400 })
  }

  if (typeof body.type !== 'string') {
    return NextResponse.json({ success: false, error: 'type is required' }, { status: 400 })
  }

  // Client events never carry order/amount data — those are written server-side.
  // Analytics must never break the storefront: any DB hiccup (transient
  // connection error, failover, etc.) is logged and swallowed instead of
  // bubbling up as a 500 that pollutes the browser console.
  try {
    const result = await trackEvent({
      type: body.type,
      path: typeof body.path === 'string' ? body.path : undefined,
      productId: typeof body.productId === 'number' ? body.productId : undefined,
      sessionId: typeof body.sessionId === 'string' ? body.sessionId : undefined,
      referrer: typeof body.referrer === 'string' ? body.referrer : undefined,
    })
    if (!result.success) {
      return NextResponse.json(result, { status: 400 })
    }
  } catch (err) {
    console.error('[track] event write failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ success: false })
  }
  return NextResponse.json({ success: true })
}
