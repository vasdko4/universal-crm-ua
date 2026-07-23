/**
 * Applies db/schema.sql, then db/migrate.sql, and (optionally) db/seed.sql to
 * the database pointed to by DATABASE_URL. No `psql` binary required — uses
 * the `pg` driver.
 *
 * This runs on every container start (see the "app" service command in
 * docker-compose.yml), including the auto-update sidecar's "recreate
 * container from new image" flow — that flow only ever swaps the image, it
 * never runs SQL by itself. schema.sql is a `CREATE TABLE IF NOT EXISTS` /
 * `CREATE TABLE ... IF NOT EXISTS column` snapshot, so on an *existing*
 * install it is a no-op for any column added to an already-created table —
 * only migrate.sql's `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements
 * actually add those columns to a live production database. Skipping it
 * silently leaves prod behind schema.sql/the app code until someone runs
 * migrate.sql by hand, which previously caused a production outage (missing
 * columns like `products.variants_enabled`, `orders.utm_source`) after an
 * unattended auto-update. migrate.sql is explicitly written to be safe to run
 * repeatedly, so this always runs, unconditionally.
 *
 * By default only schema.sql + migrate.sql are applied — the store is
 * configured through the web setup wizard on first visit
 * (http://localhost:3000). Pass --seed to also load the demo dataset
 * (products, categories, sample orders).
 *
 * Usage:
 *   node --env-file=.env.local scripts/db-setup.mjs          # schema + migrations
 *   node --env-file=.env.local scripts/db-setup.mjs --seed   # schema + migrations + demo data
 *   node --env-file=.env.local scripts/db-setup.mjs --reset  # drop public schema first
 */
import { Pool } from 'pg'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const args = process.argv.slice(2)
const withSeed = args.includes('--seed')
const reset = args.includes('--reset')

const rawConnectionString = process.env.DATABASE_URL
if (!rawConnectionString) {
  console.error('✗ DATABASE_URL is not set. Copy .env.example to .env.local first.')
  console.error('  Then run: node --env-file=.env.local scripts/db-setup.mjs')
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
    await run('applying schema.sql', readFileSync(join(root, 'db/schema.sql'), 'utf8'))
    await run('applying migrate.sql', readFileSync(join(root, 'db/migrate.sql'), 'utf8'))
    if (withSeed) {
      await run('applying seed.sql', readFileSync(join(root, 'db/seed.sql'), 'utf8'))
    }
    console.log('\n✓ Database ready.')
    if (withSeed) {
      console.log('  Demo data loaded. Admin login: admin@techno.store / Admin12345')
    } else {
      console.log('  Schema applied. Open http://localhost:3000 to run the setup wizard.')
    }
  } catch (e) {
    console.error('\n✗ Failed:', e.message)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

main()
