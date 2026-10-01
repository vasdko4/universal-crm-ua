/**
 * Encryption at rest for integration secrets stored in the database.
 *
 * Rows in `payment_gateways.config`, `delivery_methods.config` and
 * `store_settings` (SMTP password, DKIM key, Telegram bot token, Google
 * OAuth client secret) used to hold these values as plaintext JSON. Any
 * read access to the database — a backup leak, a SQL-injection elsewhere,
 * a compromised read-only credential — immediately compromised the live
 * payment tokens and API keys.
 *
 * Secrets are now encrypted with AES-256-GCM. The data key is derived via
 * HKDF-SHA256 from `BETTER_AUTH_SECRET` (already a required production
 * secret), so no new environment variable is needed. Encrypted values are
 * stored as `enc:v1:<base64(iv || ciphertext || tag)>` inside the same
 * JSONB columns, so no schema migration is required.
 *
 * Backward compatibility: `decryptSecret()` passes plaintext values
 * through untouched, so databases that have not run the one-time
 * `scripts/encrypt-secrets.mjs` migration keep working; every admin save
 * re-encrypts. `encryptSecret()` is idempotent — already-encrypted values
 * are returned as-is, so merge-and-rewrite flows (keepSecret pattern)
 * cannot double-encrypt.
 *
 * Server-side only. Never import from a 'use client' module.
 */
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'

export const ENCRYPTED_SECRET_PREFIX = 'enc:v1:'

function masterSecret(): string {
  const s = process.env.BETTER_AUTH_SECRET
  if (!s || s.length < 16) {
    throw new Error(
      '[secrets] BETTER_AUTH_SECRET must be set (min 16 chars) to encrypt/decrypt integration secrets. ' +
        'Generate one with: openssl rand -base64 32',
    )
  }
  return s
}

function dataKey(): Buffer {
  return Buffer.from(hkdfSync('sha256', masterSecret(), 'universal-crm-ua', 'integration-secrets-v1', 32))
}

export function isEncryptedSecret(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_SECRET_PREFIX)
}

/** Encrypt a plaintext secret. Idempotent: already-encrypted or empty values pass through. */
export function encryptSecret(plain: string): string {
  if (!plain || isEncryptedSecret(plain)) return plain
  const key = dataKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return ENCRYPTED_SECRET_PREFIX + Buffer.concat([iv, ciphertext, tag]).toString('base64')
}

/**
 * Decrypt a stored secret. Plaintext values (not yet migrated) pass through
 * unchanged. Throws on tampered/malformed ciphertext — fail closed.
 */
export function decryptSecret(value: unknown): string {
  if (typeof value !== 'string' || !value) return ''
  if (!isEncryptedSecret(value)) return value
  const key = dataKey()
  const raw = Buffer.from(value.slice(ENCRYPTED_SECRET_PREFIX.length), 'base64')
  if (raw.length < 12 + 16 + 1) throw new Error('[secrets] malformed encrypted secret')
  const iv = raw.subarray(0, 12)
  const tag = raw.subarray(raw.length - 16)
  const ciphertext = raw.subarray(12, raw.length - 16)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

/** Shallow-copy `config`, encrypting the listed keys. Idempotent. */
export function encryptConfigSecrets<T extends Record<string, unknown>>(
  config: T,
  keys: readonly string[],
): T {
  const out: Record<string, unknown> = { ...config }
  for (const k of keys) {
    const v = out[k]
    if (typeof v === 'string' && v && !isEncryptedSecret(v)) out[k] = encryptSecret(v)
  }
  return out as T
}

/** Shallow-copy `config`, decrypting the listed keys (plaintext passes through). */
export function decryptConfigSecrets<T extends Record<string, unknown>>(
  config: T,
  keys: readonly string[],
): T {
  const out: Record<string, unknown> = { ...config }
  for (const k of keys) {
    const v = out[k]
    if (typeof v === 'string' && isEncryptedSecret(v)) out[k] = decryptSecret(v)
  }
  return out as T
}

/** Secret-bearing keys inside `payment_gateways.config` JSONB. */
export const GATEWAY_CONFIG_SECRET_KEYS = ['token', 'merchantSecretKey', 'merchantPassword'] as const

/** Secret-bearing keys inside `delivery_methods.config` JSONB. */
export const DELIVERY_CONFIG_SECRET_KEYS = ['apiKey'] as const

/** Secret-bearing keys inside the nested `store_settings` JSONB objects. */
export const STORE_EMAIL_SECRET_KEYS = ['smtpPassword', 'dkimPrivateKey'] as const
export const STORE_NOTIFICATIONS_SECRET_KEYS = ['telegramBotToken'] as const
export const STORE_GOOGLE_AUTH_SECRET_KEYS = ['clientSecret'] as const
