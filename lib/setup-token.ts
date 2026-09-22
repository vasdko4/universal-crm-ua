import { randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * One-shot install token for `/setup`, `saveDatabaseConfig` and `runSetup`.
 *
 * Those actions are public on a fresh install (no users yet). Without a token
 * anyone on the internet can point the app at their own Postgres and become
 * the first admin. The token is generated on first boot (printed once) or
 * taken from SETUP_TOKEN / `.setup-token`.
 */
const PLACEHOLDER_TOKENS = new Set([
  'replace-me-with-openssl-rand-base64-32',
  'replace-me',
  'replaceme',
  'changeme',
  'change-me',
  'change_me',
  'secret',
  'setup-token',
  'setup_token',
  'your-secret-here',
  'todo',
  'example',
  'test',
])

const MIN_LENGTH = 16
const TOKEN_FILE = join(process.cwd(), '.setup-token')

export function isUsableSetupToken(secret: string | null | undefined): boolean {
  const value = (secret ?? '').trim()
  if (value.length < MIN_LENGTH) return false
  const lower = value.toLowerCase()
  if (PLACEHOLDER_TOKENS.has(lower)) return false
  if (lower.startsWith('replace-me') || lower.startsWith('replace_me')) return false
  return true
}

function secretsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function getConfiguredSetupToken(): string | null {
  const fromEnv = (process.env.SETUP_TOKEN ?? '').trim()
  if (isUsableSetupToken(fromEnv)) return fromEnv
  try {
    if (existsSync(TOKEN_FILE)) {
      const fromFile = readFileSync(TOKEN_FILE, 'utf8').trim().split(/\s+/)[0] ?? ''
      if (isUsableSetupToken(fromFile)) return fromFile
    }
  } catch {
    /* ignore */
  }
  return null
}

/** Create and persist a token if none is configured. Safe to call on every boot. */
export function ensureSetupToken(): { token: string; generated: boolean } {
  const existing = getConfiguredSetupToken()
  if (existing) return { token: existing, generated: false }
  const token = randomBytes(24).toString('base64url')
  try {
    writeFileSync(TOKEN_FILE, `${token}\n`, { encoding: 'utf8', mode: 0o600 })
  } catch (e) {
    console.error('[setup] could not persist .setup-token:', (e as Error).message)
  }
  process.env.SETUP_TOKEN = token
  return { token, generated: true }
}

export function authorizeSetupToken(provided: string | null | undefined): boolean {
  const expected = getConfiguredSetupToken()
  if (!expected) return false
  const got = (provided ?? '').trim()
  if (!got) return false
  return secretsMatch(got, expected)
}

/**
 * Hosts that must never be used as a Postgres target from the public wizard:
 * cloud metadata, unspecified, multicast. Loopback and RFC1918 stay allowed
 * because a valid install token is already required to reach this check, and
 * local/Docker Postgres lives there.
 */
export function isBlockedPostgresHost(host: string): boolean {
  const h = host.trim().toLowerCase().replace(/\.$/, '').replace(/^\[|\]$/g, '')
  if (!h) return true
  if (h === 'metadata.google.internal' || h.endsWith('.metadata.google.internal')) return true
  if (h === '0.0.0.0' || h === '::' || h === '0::0') return true

  if (h.includes(':')) {
    // IPv6: block link-local and unique-local metadata-ish ranges, allow ::1.
    if (h === '::1') return false
    if (h.startsWith('fe80:') || h.startsWith('ff')) return true
    return false
  }

  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h)
  if (m) {
    const oct = m.slice(1).map(Number)
    if (oct.some((n) => n > 255)) return true
    const [a, b] = oct
    if (a === 169 && b === 254) return true // link-local / cloud metadata
    if (a === 0) return true
    if (a >= 224) return true // multicast + reserved
    return false
  }
  return false
}

export function postgresHostFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname || null
  } catch {
    return null
  }
}
