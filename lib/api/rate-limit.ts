import { pool } from '@/lib/db'

/**
 * Shared rate limiter for public write endpoints (checkout, reviews, OTP,
 * Prom/NP proxies).
 *
 * The previous in-memory Map was per Node isolate: every Vercel instance (and
 * every warm lambda) had its own counter, so the limit never held under load.
 * Order of backends:
 *   1. Upstash Redis REST, if UPSTASH_REDIS_REST_URL + TOKEN are set
 *   2. Postgres `rate_limits` table (already on every install)
 *   3. Process memory, only if both shared stores fail — still better than
 *      no limit, but not multi-instance safe
 *
 * `x-forwarded-for` is trivially spoofable. Prefer the platform-provided
 * client IP (Vercel), then X-Real-IP, then the last XFF hop.
 */

type Bucket = { count: number; resetAt: number }
const memory = new Map<string, Bucket>()

function lastForwardedHop(value: string | null): string | null {
  if (!value) return null
  const hops = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return hops.at(-1) ?? null
}

export function clientIpFromHeaders(h: { get(name: string): string | null }): string {
  const vercel = h.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
  if (vercel) return vercel
  const real = h.get('x-real-ip')?.trim()
  if (real) return real
  // nginx `$proxy_add_x_forwarded_for` prepends the caller, so the last hop
  // is the address the proxy actually saw. The first hop is client-controlled.
  const forwarded = lastForwardedHop(h.get('x-forwarded-for'))
  return forwarded || 'unknown'
}

/** Higher ceiling when the IP cannot be resolved, so shoppers sharing
 *  the sentinel key do not 429 each other (FIX-33). */
export function unknownIpCeiling(max: number): number {
  return Math.max(max * 20, 200)
}

export function clientIp(req: Request): string {
  return clientIpFromHeaders(req.headers)
}

export async function isRateLimited(
  scope: string,
  ip: string,
  max: number,
  windowMs = 60_000,
  opts: { relaxUnknown?: boolean } = {},
): Promise<boolean> {
  const resolved = ip || 'unknown'
  const ceiling =
    resolved === 'unknown' && opts.relaxUnknown ? unknownIpCeiling(max) : max
  const key = `${scope}:${resolved}`
  const upstash = await upstashLimited(key, ceiling, windowMs)
  if (upstash !== null) return upstash
  const pg = await postgresLimited(key, ceiling, windowMs)
  if (pg !== null) return pg
  return memoryLimited(key, ceiling, windowMs)
}

/**
 * Hot read paths (image proxy): in-process burst first, then Upstash as a
 * shared ceiling across instances. Postgres is skipped on purpose — a catalog
 * grid would otherwise hit it on every thumbnail.
 */
export function isRateLimitedMemory(
  scope: string,
  ip: string,
  max: number,
  windowMs = 60_000,
): boolean {
  return memoryLimited(`${scope}:${ip || 'unknown'}`, max, windowMs)
}

export async function isRateLimitedHot(
  scope: string,
  ip: string,
  max: number,
  windowMs = 60_000,
): Promise<boolean> {
  const key = `${scope}:${ip || 'unknown'}`
  if (memoryLimited(key, max, windowMs)) return true
  // 150ms: a hung Upstash must not stall every catalog thumbnail.
  const upstash = await upstashLimited(`hot:${key}`, max, windowMs, 150)
  return upstash === true
}

async function upstashLimited(
  key: string,
  max: number,
  windowMs: number,
  timeoutMs = 500,
): Promise<boolean | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, '')
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCR', key],
        ['PTTL', key],
      ]),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { result?: number }[]
    const count = Number(json[0]?.result ?? 0)
    const ttl = Number(json[1]?.result ?? -1)
    if (count === 1 || ttl < 0) {
      await fetch(`${url}/pexpire/${encodeURIComponent(key)}/${windowMs}`, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { Authorization: `Bearer ${token}` },
      })
    }
    return count > max
  } catch (e) {
    const name = (e as Error).name
    if (name !== 'TimeoutError' && name !== 'AbortError') {
      console.error('[rate-limit] upstash failed:', (e as Error).message)
    }
    return null
  }
}

async function postgresLimited(key: string, max: number, windowMs: number): Promise<boolean | null> {
  try {
    const { rows } = await pool.query<{ count: number }>(
      `INSERT INTO rate_limits (key, count, reset_at)
       VALUES ($1, 1, NOW() + ($2::text || ' milliseconds')::interval)
       ON CONFLICT (key) DO UPDATE SET
         count = CASE WHEN rate_limits.reset_at <= NOW() THEN 1 ELSE rate_limits.count + 1 END,
         reset_at = CASE WHEN rate_limits.reset_at <= NOW() THEN EXCLUDED.reset_at ELSE rate_limits.reset_at END
       RETURNING count`,
      [key, String(windowMs)],
    )
    return (rows[0]?.count ?? 1) > max
  } catch (e) {
    console.error('[rate-limit] postgres limiter failed:', (e as Error).message)
    return null
  }
}

function memoryLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = memory.get(key)
  if (!entry || now > entry.resetAt) {
    memory.set(key, { count: 1, resetAt: now + windowMs })
    if (memory.size > 10_000) {
      for (const [k, v] of memory) if (now > v.resetAt) memory.delete(k)
    }
    return false
  }
  entry.count++
  return entry.count > max
}
