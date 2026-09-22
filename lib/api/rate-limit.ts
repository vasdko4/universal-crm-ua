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
 * client IP (Vercel) and only then the first XFF hop.
 */

type Bucket = { count: number; resetAt: number }
const memory = new Map<string, Bucket>()

export function clientIp(req: Request): string {
  const vercel = req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
  if (vercel) return vercel
  const real = req.headers.get('x-real-ip')?.trim()
  if (real) return real
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || 'unknown'
}

export async function isRateLimited(
  scope: string,
  ip: string,
  max: number,
  windowMs = 60_000,
): Promise<boolean> {
  const key = `${scope}:${ip || 'unknown'}`
  const upstash = await upstashLimited(key, max, windowMs)
  if (upstash !== null) return upstash
  const pg = await postgresLimited(key, max, windowMs)
  if (pg !== null) return pg
  return memoryLimited(key, max, windowMs)
}

/**
 * In-process limiter for hot read paths (image proxy). Catalog grids fire
 * dozens of `/api/media` requests per page; hitting Postgres/Upstash on each
 * one adds latency and turns a slow DB into broken thumbnails (`media:1`).
 */
export function isRateLimitedMemory(
  scope: string,
  ip: string,
  max: number,
  windowMs = 60_000,
): boolean {
  return memoryLimited(`${scope}:${ip || 'unknown'}`, max, windowMs)
}

async function upstashLimited(key: string, max: number, windowMs: number): Promise<boolean | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, '')
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
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
        headers: { Authorization: `Bearer ${token}` },
      })
    }
    return count > max
  } catch (e) {
    console.error('[rate-limit] upstash failed:', (e as Error).message)
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
