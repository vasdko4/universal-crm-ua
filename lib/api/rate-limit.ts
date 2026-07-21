// Naive in-memory rate limiter shared by public write endpoints (reviews,
// questions, analytics). Good enough to stop casual flooding without extra
// infrastructure. Each serverless instance keeps its own map, so treat the
// limit as approximate, not exact.

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

/**
 * Returns true when `ip` has exceeded `max` hits within the window for the
 * given `scope` (a label so different endpoints don't share one budget).
 */
export function isRateLimited(scope: string, ip: string, max: number, windowMs = 60_000): boolean {
  const key = `${scope}:${ip}`
  const now = Date.now()
  const entry = buckets.get(key)
  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    // Opportunistic cleanup so the map never grows unbounded.
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k)
    }
    return false
  }
  entry.count++
  return entry.count > max
}

/** Extract the client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}
