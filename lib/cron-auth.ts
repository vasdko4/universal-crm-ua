import { timingSafeEqual } from 'node:crypto'

/**
 * Shared authorization for cron-triggered endpoints (Vercel Cron, systemd
 * timers, external schedulers).
 *
 * The rule is fail CLOSED: an endpoint that mutates data or spends a third
 * party API quota must refuse to run when no usable secret is configured.
 * Previously a missing CRON_SECRET meant "no auth required", so anyone who
 * knew the URL could trigger delivery syncs, burn the Nova Poshta quota and
 * email customers about status changes.
 *
 * A *placeholder* secret is treated as "not configured" on purpose: copying
 * .env.example without editing it used to produce a technically-set but
 * publicly known secret, which is no better than having none.
 */
const PLACEHOLDER_SECRETS = new Set([
  'replace-me-with-openssl-rand-base64-32',
  'replace-me',
  'replaceme',
  'changeme',
  'change-me',
  'change_me',
  'secret',
  'cron-secret',
  'cron_secret',
  'your-secret-here',
  'todo',
  'example',
  'test',
])

/** Minimum length we accept; `openssl rand -base64 32` yields 44 characters. */
export const MIN_CRON_SECRET_LENGTH = 16

export type CronAuthFailure = {
  ok: false
  /** 503 = server misconfigured (no secret), 401 = caller is not authorized. */
  status: 503 | 401
  error: string
}

export type CronAuthResult = { ok: true } | CronAuthFailure

/**
 * True when the value is a real secret rather than missing, blank, too short
 * or one of the well-known placeholders shipped in example env files.
 */
export function isUsableCronSecret(secret: string | null | undefined): boolean {
  const value = (secret ?? '').trim()
  if (value.length < MIN_CRON_SECRET_LENGTH) return false
  const lower = value.toLowerCase()
  if (PLACEHOLDER_SECRETS.has(lower)) return false
  if (lower.startsWith('replace-me') || lower.startsWith('replace_me')) return false
  return true
}

/** Constant-time comparison so a wrong header can't be brute-forced by timing. */
function secretsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/**
 * Authorizes a cron request against the configured secret.
 *
 * - no usable secret  -> 503, endpoint stays closed (never runs unauthenticated)
 * - wrong/absent header -> 401
 */
export function authorizeCronRequest(
  configuredSecret: string | null | undefined,
  authorizationHeader: string | null | undefined,
): CronAuthResult {
  if (!isUsableCronSecret(configuredSecret)) {
    return { ok: false, status: 503, error: 'Unauthorized' }
  }
  const expected = `Bearer ${(configuredSecret as string).trim()}`
  const provided = (authorizationHeader ?? '').trim()
  if (!provided || !secretsMatch(provided, expected)) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }
  return { ok: true }
}
