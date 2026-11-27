import { randomBytes, createHash, timingSafeEqual } from 'node:crypto'

// Guest order access token (3.4.107, fix 5).
//
// The old `pf_last_order` cookie held the plain order number, so anyone who
// knew (or guessed) an order number could read the whole order — name,
// phone, email, delivery address — from /order/[n] and /checkout/pay/[n].
// The cookie now holds only a random token; the DB stores only its SHA-256
// hash (same reasoning as password storage: a DB leak alone grants no
// order access). The order number stays a public-ish identifier shown in
// emails/UI and is never an access credential on its own.
//
// Token: 32 random bytes, base64url-encoded (43 chars, no padding).
// Hash: lowercase hex SHA-256 (64 chars) — fits orders.guest_access_token_hash
// varchar(64). Verification is constant-time over the hash bytes.

export const GUEST_ACCESS_TOKEN_BYTES = 32

/** Base64url of 32 bytes: 43 chars, no padding. A legacy plain order number (12 digits) never matches. */
export const GUEST_ACCESS_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/

export type GuestAccessToken = {
  /** Plaintext token — goes into the pf_last_order cookie only, never into the DB or logs. */
  token: string
  /** SHA-256 hex of the token — the only value stored (orders.guest_access_token_hash). */
  tokenHash: string
}

export function createGuestAccessToken(): GuestAccessToken {
  const token = randomBytes(GUEST_ACCESS_TOKEN_BYTES).toString('base64url')
  return { token, tokenHash: hashGuestAccessToken(token) }
}

export function hashGuestAccessToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function isGuestAccessTokenFormat(value: unknown): value is string {
  return typeof value === 'string' && GUEST_ACCESS_TOKEN_RE.test(value)
}

/**
 * Constant-time check of a presented token against a stored SHA-256 hex
 * hash. Returns false for anything malformed — empty token, missing hash,
 * wrong-length/non-hex hash, or a legacy plain order number — without
 * leaking, via timing, which of those it was.
 */
export function verifyGuestAccessToken(token: unknown, storedHash: unknown): boolean {
  if (typeof token !== 'string' || token.length === 0) return false
  if (typeof storedHash !== 'string' || !/^[0-9a-f]{64}$/.test(storedHash)) return false
  const presentedHash = Buffer.from(hashGuestAccessToken(token), 'hex')
  const expectedHash = Buffer.from(storedHash, 'hex')
  if (presentedHash.length !== expectedHash.length) return false
  try {
    return timingSafeEqual(presentedHash, expectedHash)
  } catch {
    return false
  }
}
