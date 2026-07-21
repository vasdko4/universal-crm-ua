/**
 * Restores the FULL current-database snapshot (schema + all data) from
 * db/dump.sql into the database pointed to by DATABASE_URL. This is what you
 * want when you need an exact local copy of the current demo store — every
 * product, category, gallery, article, order and setting included.
 *
 * No `psql` binary required — uses the `pg` driver. The dump is a single
 * self-contained SQL file (produced by scripts/dump-db.mjs) that creates
 * sequences, tables, data, constraints and indexes in a dependency-safe order.
 *
 * Usage:
 *   node --env-file=.env.local scripts/db-restore.mjs           # restore into an empty DB
 *   node --env-file=.env.local scripts/db-restore.mjs --reset   # drop everything first (recommended)
 */
import { Pool } from 'pg'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const dumpPath = join(root, 'db/dump.sql')

const args = process.argv.slice(2)
const reset = args.includes('--reset')

const rawConnectionString = process.env.DATABASE_URL
if (!rawConnectionString) {
  console.error('✗ DATABASE_URL is not set. Copy .env.example to .env.local first.')
  console.error('  Then run: node --env-file=.env.local scripts/db-restore.mjs --reset')
  process.exit(1)
}

if (!existsSync(dumpPath)) {
  console.error('✗ db/dump.sql not found. Generate it first with: pnpm db:dump')
  process.exit(1)
}

// Managed providers (Neon, Supabase, RDS, …) require SSL; local Postgres has none.
const requiresSsl =
  /[?&]sslmode=(require|verify-ca|verify-full)/.test(rawConnectionString) ||
  /\b(neon\.tech|supabase\.co|amazonaws\.com|render\.com|azure\.com|cockroachlabs\.cloud)\b/.test(
    rawConnectionString,
  )

// Strip libpq SSL params so pg does not emit its `sslmode` deprecation warning;
// SSL is passed explicitly via the `ssl` option instead.
const connectionString = rawConnectionString
  .replace(/([?&])sslmode=[^&]*/gi, '$1')
  .replace(/([?&])channel_binding=[^&]*/gi, '$1')
  .replace(/[?&]+$/g, '')
  .replace(/\?&/g, '?')
  .replace(/&&+/g, '&')

const pool = new Pool({
  connectionString,
  ssl: requiresSsl ? { rejectUnauthorized: false } : false,
})

async function run(label, sql) {
  process.stdout.write(`→ ${label}... `)
  await pool.query(sql)
  console.log('ok')
}

async function main() {
  try {
    if (reset) {
      await run('resetting public schema', 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
    }
    const dump = readFileSync(dumpPath, 'utf8')
    await run(`restoring db/dump.sql (${(Buffer.byteLength(dump) / 1024).toFixed(0)} KB)`, dump)
    console.log('\n✓ Database restored from the current-store snapshot.')
    console.log('  Start the app:  pnpm dev  →  http://localhost:3000')
  } catch (e) {
    console.error('\n✗ Failed:', e.message)
    if (!reset) {
      console.error('  Tip: run with --reset to drop existing objects first:')
      console.error('  node --env-file=.env.local scripts/db-restore.mjs --reset')
    }
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

main()
