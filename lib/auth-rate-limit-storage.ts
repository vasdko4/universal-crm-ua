import { isRateLimited } from '@/lib/api/rate-limit'

type RateLimit = { key: string; count: number; lastRequest: number }
type Rule = { window: number; max: number }

/**
 * Better Auth's default limiter is in-memory per isolate (FIX-30). Reuse the
 * app's Upstash → Postgres → memory stack so sign-in budgets hold across
 * Vercel instances and Node workers.
 *
 * Keys are already `ip|path` from Better Auth; we slice to fit `rate_limits.key`
 * varchar(200) together with the `better-auth:` prefix.
 */
export const authRateLimitStorage = {
  async get(_key: string): Promise<RateLimit | null> {
    return null
  },
  async set(_key: string, _value: RateLimit): Promise<void> {
    /* consume() is the source of truth */
  },
  async consume(key: string, rule: Rule) {
    const limited = await isRateLimited(
      'better-auth',
      key.slice(0, 180),
      rule.max,
      rule.window * 1000,
    )
    return { allowed: !limited, retryAfter: limited ? rule.window : null }
  },
}
