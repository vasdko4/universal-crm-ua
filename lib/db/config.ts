import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ENV_PATH = join(process.cwd(), '.env.local')

/** Parse a simple KEY=value .env file into a record (best effort). */
function readEnvLocal(): Record<string, string> {
  if (!existsSync(ENV_PATH)) return {}
  const out: Record<string, string> = {}
  for (const raw of readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

/**
 * Resolve the Postgres connection string. Prefers the runtime environment
 * (set by the platform or Next.js from .env.local), and falls back to reading
 * .env.local directly so CLI scripts and freshly-saved config also work.
 */
export function getConnectionString(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const env = readEnvLocal()
  return env.DATABASE_URL || undefined
}

/**
 * Persist DATABASE_URL to .env.local (preserving other keys) and update the
 * live process so scripts started later in this process see it too. Note that
 * Better Auth and the shared pool are created at boot, so a dev-server restart
 * is still required for them to pick up a brand-new connection.
 */
export function saveDatabaseUrl(url: string) {
  const env = readEnvLocal()
  env.DATABASE_URL = url
  const body =
    Object.entries(env)
      .map(([k, v]) => (/\s|#|"/.test(v) ? `${k}="${v.replace(/"/g, '\\"')}"` : `${k}=${v}`))
      .join('\n') + '\n'
  writeFileSync(ENV_PATH, body, 'utf8')
  process.env.DATABASE_URL = url
}

/**
 * Decide the SSL setting for a connection string. Local Postgres (OSPanel,
 * Docker, a plain local install) has no TLS, so SSL must be OFF or the
 * handshake fails. Managed providers require SSL, so enable it for them or
 * when the URL explicitly asks (sslmode=require).
 */
export function sslForConnectionString(url: string): false | { rejectUnauthorized: false } {
  if (/[?&]sslmode=(require|verify-ca|verify-full)/.test(url)) return { rejectUnauthorized: false }
  if (/\b(neon\.tech|supabase\.co|amazonaws\.com|render\.com|azure\.com|cockroachlabs\.cloud)\b/.test(url))
    return { rejectUnauthorized: false }
  return false
}

/**
 * Remove libpq-style SSL query params (`sslmode`, `channel_binding`) from a
 * connection string. `pg` emits a deprecation warning when it parses
 * `sslmode=require` (future versions will treat it as `verify-full`). We decide
 * SSL ourselves via `sslForConnectionString`, so these params are redundant and
 * are stripped to keep output clean and behavior stable across pg versions.
 */
export function stripSslParams(url: string): string {
  return url
    .replace(/([?&])sslmode=[^&]*/gi, '$1')
    .replace(/([?&])channel_binding=[^&]*/gi, '$1')
    .replace(/[?&]+$/g, '')
    .replace(/\?&/g, '?')
    .replace(/&&+/g, '&')
}

/** Build a Postgres connection string from individual fields (setup wizard). */
export function buildConnectionString(parts: {
  host: string
  port: string | number
  database: string
  user: string
  password: string
  ssl?: boolean
}): string {
  const host = parts.host.trim() || 'localhost'
  const port = String(parts.port || 5432).trim()
  const database = parts.database.trim()
  const user = encodeURIComponent(parts.user.trim())
  const password = encodeURIComponent(parts.password)
  const auth = password ? `${user}:${password}` : user
  const query = parts.ssl ? '?sslmode=require' : ''
  return `postgresql://${auth}@${host}:${port}/${database}${query}`
}
