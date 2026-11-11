import { createHmac } from 'node:crypto'

/**
 * Hash for the 6-digit email/password codes stored in Better Auth's
 * `verification` table (value is JSON: { codeHash } / { email, codeHash }).
 *
 * A plain SHA-256 of a 6-digit code is brute-forceable from a DB dump
 * (1M candidates), so the code is HMAC'd with the server secret instead:
 * a leak of the table alone reveals nothing. BETTER_AUTH_SECRET is
 * required for the app to run at all, so its absence is a hard error.
 *
 * Codes issued before this change stored the plaintext `code` field and
 * simply stop matching — the user requests a new code.
 */
export function hashVerificationCode(code: string): string {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) throw new Error('BETTER_AUTH_SECRET is not configured')
  return createHmac('sha256', secret).update(code, 'utf8').digest('hex')
}
