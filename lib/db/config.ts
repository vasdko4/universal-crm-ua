import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { trimQueryJunk } from '@/lib/text'

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
      .map(([k, v]) => {
        // Strip CR/LF: a pasted value with a line break would otherwise
        // inject extra keys into .env.local. Escape backslashes before
        // quotes — inside double-quoted .env values backslash is the
        // escape character, so an unescaped one corrupts parsing.
        const clean = v.replace(/[\r\n]+/g, '')
        const escaped = clean.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
        return /\s|#|"/.test(clean) ? `${k}="${escaped}"` : `${k}=${clean}`
      })
      .join('\n') + '\n'
  writeFileSync(ENV_PATH, body, 'utf8')
  process.env.DATABASE_URL = url
}

/**
 * Resolve the CA certificate for verified TLS (sslmode=verify-ca /
 * verify-full). Sources, in order:
 * 1. DB_SSL_CA — the CA certificate itself, as PEM text.
 * 2. PGSSLROOTCERT — path to a PEM file (the libpq convention).
 *
 * Throws when neither is set: verified TLS without a CA would silently
 * fall back to unverified, so fail loudly at boot instead. lib/db/index.ts
 * calls sslForConnectionString() at module load, so this surfaces before
 * the pool ever connects.
 */
export function resolveSslCa(): string {
  const pem = process.env.DB_SSL_CA?.trim()
  if (pem) {
    // .env values often carry the PEM with literal \n escapes instead of
    // real newlines; normalize so node-postgres accepts the certificate.
    return pem.includes('\n') ? pem : pem.replace(/\\n/g, '\n')
  }
  const path = process.env.PGSSLROOTCERT?.trim()
  if (path) return readFileSync(path, 'utf8')
  throw new Error(
    'DATABASE_URL requests verified TLS (sslmode=verify-ca or verify-full) but no CA is configured: ' +
      'set DB_SSL_CA to the CA certificate (PEM) or PGSSLROOTCERT to the path of a CA file.',
  )
}

/**
 * Decide the SSL setting for a connection string. Local Postgres (OSPanel,
 * Docker, a plain local install) has no TLS, so SSL must be OFF or the
 * handshake fails. Managed providers require SSL, so enable it for them or
 * when the URL explicitly asks (sslmode=require).
 */
export function sslForConnectionString(
  url: string,
): false | { rejectUnauthorized: boolean; ca?: string } {
  const mode = /[?&]sslmode=([a-z-]+)/.exec(url)?.[1]
  if (mode === 'verify-full' || mode === 'verify-ca') {
    // Verified TLS: rejectUnauthorized + the CA. resolveSslCa() throws
    // when no CA is configured, so a misconfigured URL fails at boot
    // instead of silently connecting unverified.
    return { rejectUnauthorized: true, ca: resolveSslCa() }
  }
  // Managed Postgres (Neon/Supabase/RDS) terminates TLS with a CA Node does
  // not ship. Deliberate tradeoff, same as `sslmode=require`: encrypt the
  // wire and skip CA verification — this protects against passive sniffing
  // but not an active MITM on the provider's own network. Pinning the
  // providers' rotating certificates is not practical; use
  // sslmode=verify-full with DB_SSL_CA/PGSSLROOTCERT when verification
  // matters (e.g. a self-hosted Postgres behind a known CA).
  // nosemgrep: javascript.lang.security.audit.ssl-verify-disabled.bypass-tls-verification
  if (mode === 'require' || /\b(neon\.tech|supabase\.co|amazonaws\.com|render\.com|azure\.com|cockroachlabs\.cloud)\b/.test(url))
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
  return trimQueryJunk(
    url
      .replace(/([?&])sslmode=[^&]*/gi, '$1')
      .replace(/([?&])channel_binding=[^&]*/gi, '$1')
      .replace(/\?&/g, '?')
      .replace(/&&+/g, '&'),
  )
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
  // The wizard feeds admin-typed values straight into a URL the server then
  // probes — validate every interpolated part so a crafted host/port cannot
  // inject URL structure (`@`, `/`, `?`, `#`) and redirect the probe.
  const host = parts.host.trim() || 'localhost'
  if (host.length > 253 || !/^(\[[0-9a-fA-F:]+\]|[A-Za-z0-9.-]+)$/.test(host)) {
    throw new Error('Некорректный хост базы данных')
  }
  // An empty port keeps the old default (the wizard form may omit it).
  const portNum = parts.port === '' || parts.port == null ? 5432 : Number(parts.port)
  if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
    throw new Error('Некорректный порт базы данных')
  }
  const database = parts.database.trim()
  if (!database || database.length > 63 || /[/?#\s]/.test(database)) {
    throw new Error('Некорректное имя базы данных')
  }
  const user = parts.user.trim()
  if (!user || user.length > 63 || /[/?#\s]/.test(user)) {
    throw new Error('Некорректное имя пользователя базы данных')
  }
  const auth = encodeURIComponent(parts.password)
    ? `${encodeURIComponent(user)}:${encodeURIComponent(parts.password)}`
    : encodeURIComponent(user)
  const query = parts.ssl ? '?sslmode=require' : ''
  return `postgresql://${auth}@${host}:${portNum}/${database}${query}`
}
