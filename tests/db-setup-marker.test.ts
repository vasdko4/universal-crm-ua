import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
// Structural tests compare source text with LF literals; normalize CRLF so
// they also pass on a Windows checkout (see the CRLF fix, 11.11.2026).
const source = (file: string) => readFileSync(resolve(root, file), 'utf8').replace(/\r\n/g, '\n')

const SCRIPT = resolve(root, 'scripts/db-setup.mjs')

function runScript(
  args: string[],
  env: Record<string, string | undefined>,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [SCRIPT, ...args], {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => {
      stdout += d
    })
    child.stderr.on('data', (d) => {
      stderr += d
    })
    child.on('error', reject)
    child.on('close', (code) => resolvePromise({ code, stdout, stderr }))
  })
}

describe('db:setup stamps the migration marker (audit P2, 3.4.96)', () => {
  const script = source('scripts/db-setup.mjs')

  it('computes the sha256 of db/migrate.sql with CRLF → LF normalization', () => {
    // The trap: migrationSqlHash() in lib/db/migrate-runner.ts hashes the
    // bundle, and the bundle is generated from db/migrate.sql with CRLF →
    // LF normalization (scripts/sync-migrate-bundle.mjs). Hashing the raw
    // file bytes would write a non-matching hash on a CRLF checkout.
    expect(script).toContain("import { createHash } from 'node:crypto'")
    expect(script).toContain("createHash('sha256')")
    expect(script).toContain(".replace(/\\r\\n/g, '\\n')")
    expect(script).toContain("readFileSync(join(root, 'db', 'migrate.sql'), 'utf8')")
  })

  it('upserts the marker into schema_migrations (id = 1) with the same statement as applyMigrations', () => {
    expect(script).toContain('INSERT INTO public.schema_migrations (id, migrate_sql_sha256, applied_at)')
    expect(script).toContain('ON CONFLICT (id) DO UPDATE')
    expect(script).toContain('SET migrate_sql_sha256 = EXCLUDED.migrate_sql_sha256, applied_at = now()')
  })

  it('stamps after the final migrate.sql application, including the post-seed re-apply', () => {
    const stampAt = script.indexOf('await stampMigrationMarker()')
    expect(stampAt).toBeGreaterThan(-1)
    expect(stampAt).toBeGreaterThan(script.indexOf('re-applying migrate.sql after seed'))
    expect(stampAt).toBeLessThan(script.indexOf("console.log('\\n✓ Database ready.')"))
  })

  it('the file hash is a deterministic sha256 hex', () => {
    const sql = readFileSync(resolve(root, 'db', 'migrate.sql'), 'utf8').replace(/\r\n/g, '\n')
    const hash = createHash('sha256').update(sql, 'utf8').digest('hex')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).toBe(createHash('sha256').update(sql, 'utf8').digest('hex'))
  })
})

// Live tests need a reachable Postgres. Run locally with e.g.
//   TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres pnpm test tests/db-setup-marker.test.ts
// (or leave TEST_DATABASE_URL unset and have postgres on localhost:5432
// with user `postgres` / password `postgres`). They use a dedicated
// throwaway database (db_setup_marker_test), created and dropped by the
// suite, so they cannot disturb other tests' tables — and skip when no
// server answers. CI has no Postgres service, so they skip there.
const TEST_DB = 'db_setup_marker_test'
const maintenanceUrl = new URL(
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/postgres',
)
const testDbUrl = new URL(maintenanceUrl.toString())
testDbUrl.pathname = `/${TEST_DB}`

const hasNodeModules = existsSync(resolve(root, 'node_modules', 'pg', 'package.json'))

let PoolCtor: new (opts: { connectionString: string; connectionTimeoutMillis?: number }) => {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>
  end: () => Promise<void>
} | null = null
let dbAvailable = false
try {
  const pg = await import('pg')
  PoolCtor = pg.Pool
  const probe = new pg.Pool({ connectionString: maintenanceUrl.toString(), connectionTimeoutMillis: 2000 })
  await probe.query('SELECT 1')
  await probe.end()
  dbAvailable = true
} catch {
  dbAvailable = false
}
const describeDb = dbAvailable && hasNodeModules ? describe : describe.skip

describeDb('db:setup live: marker stamped, getMigrationStatus up to date', () => {
  let maint: {
    query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>
    end: () => Promise<void>
  }

  function expectedHash(): string {
    const sql = readFileSync(resolve(root, 'db', 'migrate.sql'), 'utf8').replace(/\r\n/g, '\n')
    return createHash('sha256').update(sql, 'utf8').digest('hex')
  }

  async function markerRow() {
    const pool = new PoolCtor!({ connectionString: testDbUrl.toString() })
    try {
      const { rows } = await pool.query(
        'SELECT migrate_sql_sha256, applied_at FROM public.schema_migrations WHERE id = 1',
      )
      return rows[0] as { migrate_sql_sha256: string; applied_at: Date } | undefined
    } finally {
      await pool.end()
    }
  }

  async function migrationStatus() {
    // getMigrationStatus() reads the app pool, which is created at module
    // load from process.env.DATABASE_URL — so the env must be set before
    // the first (dynamic) import of the runner in this file. Nothing in
    // this file statically imports '@/lib/db/migrate-runner'.
    process.env.DATABASE_URL = testDbUrl.toString()
    const { getMigrationStatus } = await import('@/lib/db/migrate-runner')
    return getMigrationStatus()
  }

  beforeAll(async () => {
    maint = new PoolCtor!({ connectionString: maintenanceUrl.toString() })
    await maint.query(`DROP DATABASE IF EXISTS ${TEST_DB}`)
    await maint.query(`CREATE DATABASE ${TEST_DB}`)
  })

  afterAll(async () => {
    // The app pool (loaded by the dynamic import above) holds connections
    // to the test DB; dropping the DB while connected fails, so end it
    // first via a fresh import of the same module instance.
    try {
      const { pool } = await import('@/lib/db')
      await pool.end()
    } catch {
      // Pool was never loaded (test skipped) — nothing to end.
    }
    await maint.query(`DROP DATABASE IF EXISTS ${TEST_DB}`)
    await maint.end()
  })

  it('db:setup --reset stamps the marker; getMigrationStatus reports up to date', async () => {
    const { code, stdout, stderr } = await runScript(['--reset'], { DATABASE_URL: testDbUrl.toString() })
    expect(stderr).not.toContain('Failed:')
    expect(code).toBe(0)
    expect(stdout).toContain('stamping migration marker... ok')

    const row = await markerRow()
    expect(row?.migrate_sql_sha256).toBe(expectedHash())
    expect(row?.applied_at).toBeTruthy()

    const status = await migrationStatus()
    expect(status.ok).toBe(true)
    expect(status.appliedVersion).toBe(expectedHash())
    expect(status.currentVersion).toBe(expectedHash())
    expect(status.upToDate).toBe(true)
  }, 120_000)

  it('a second db:setup run (no --reset, the container-start path) keeps the marker up to date', async () => {
    const { code, stdout, stderr } = await runScript([], { DATABASE_URL: testDbUrl.toString() })
    expect(stderr).not.toContain('Failed:')
    expect(code).toBe(0)
    expect(stdout).toContain('stamping migration marker... ok')

    const status = await migrationStatus()
    expect(status.upToDate).toBe(true)
    expect(status.appliedVersion).toBe(expectedHash())
  }, 120_000)
})
