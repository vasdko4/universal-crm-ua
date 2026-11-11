import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

const root = resolve(import.meta.dirname, '..')
// Structural tests compare source text with LF literals; normalize CRLF so
// they also pass on a Windows checkout (see the CRLF fix, 11.11.2026).
const source = (file: string) => readFileSync(resolve(root, file), 'utf8').replace(/\r\n/g, '\n')

const SCRIPT = resolve(root, 'scripts/db-restore-backup.mjs')

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

describe('audit F1 (3.4.96): --latest guard', () => {
  const script = source('scripts/db-restore-backup.mjs')

  it('lets --latest pass the guard to the Blob-listing branch', () => {
    // The old guard threw for --latest before the listing branch could run;
    // deleting only the first disjunct is not enough either ('--latest'
    // matches neither .jsonl.gz nor '/'), so the guard must exempt it.
    expect(script).toContain("if (arg !== '--latest' && !arg.endsWith('.jsonl.gz') && !arg.includes('/')) {")
    expect(script).not.toContain("if (arg === '--latest' || (!arg.endsWith('.jsonl.gz')")
  })

  it('still lists Blob backups by prefix for --latest', () => {
    expect(script).toContain("if (arg.startsWith(BACKUP_PREFIX) || arg === '--latest')")
    expect(script).toContain("const page = await list({ prefix: BACKUP_PREFIX, token })")
  })
})

describe('audit F2 (3.4.96): restorer streams instead of buffering', () => {
  const script = source('scripts/db-restore-backup.mjs')

  it('streams the dump through gunzip, never loads it whole', () => {
    expect(script).toContain('createGunzip')
    expect(script).toContain('createReadStream')
    expect(script).toContain('Readable.fromWeb')
    expect(script).toContain('async function* linesOf')
    expect(script).not.toContain('gunzipSync(bytes)')
    expect(script).not.toContain('Buffer.from(await res.arrayBuffer())')
    expect(script).not.toContain('const byTable = new Map()')
    expect(script).not.toContain("const text = gunzipSync(bytes).toString('utf8')")
  })

  it('TRUNCATEs from the manifest table list, not from observed rows', () => {
    expect(script).toContain('const manifestTables = Array.isArray(manifest.tables) ? manifest.tables : []')
    expect(script).toContain('let tableNames = manifestTables.map((t) => t?.name)')
    expect(script).not.toContain('const tables = [...byTable.keys()]')
  })

  it('keeps the single transaction, setval replay and MAX(id) fallback', () => {
    expect(script).toContain("await client.query('BEGIN')")
    expect(script).toContain("await client.query('COMMIT')")
    expect(script).toContain("await client.query('ROLLBACK')")
    expect(script).toContain('SELECT setval($1::regclass, $2, $3)')
    expect(script).toContain('pg_get_serial_sequence')
    expect(script).toContain('MAX("id")')
  })
})

// The script imports 'pg' at module load, so the subprocess tests need
// node_modules present (true in the /opt verification mirror and in CI).
const hasNodeModules = existsSync(resolve(root, 'node_modules', 'pg', 'package.json'))
const describeCli = hasNodeModules ? describe : describe.skip

describeCli('audit F1 (3.4.96): --latest CLI regression', () => {
  const env = { DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/postgres' }

  it('reaches the Blob branch: missing-token error, not the prefix-listing error', async () => {
    const runEnv = { ...env, BLOB_READ_WRITE_TOKEN: undefined }
    const { code, stdout, stderr } = await runScript(['--latest'], runEnv)
    const out = stdout + stderr
    expect(code).not.toBe(0)
    expect(out).toContain('BLOB_READ_WRITE_TOKEN is not set')
    expect(out).not.toContain('Blob download by prefix listing')
  }, 30_000)

  it('a bare name still throws the prefix-listing error', async () => {
    const { code, stdout, stderr } = await runScript(['foo'], env)
    const out = stdout + stderr
    expect(code).not.toBe(0)
    expect(out).toContain('Blob download by prefix listing')
  }, 30_000)
})

// Live restore tests need a reachable Postgres. Run locally with e.g.
//   TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres pnpm test tests/db-restore-backup.test.ts
// (or leave TEST_DATABASE_URL unset and have postgres on localhost:5432
// with user `postgres` / password `postgres`). The tests only ever touch
// tables named restore_test_* in that database, and skip when no server
// answers — CI has no Postgres service, so they skip there.
const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/postgres'

let PoolCtor: new (opts: { connectionString: string; connectionTimeoutMillis?: number }) => {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>
  end: () => Promise<void>
} | null = null
let dbAvailable = false
try {
  const pg = await import('pg')
  PoolCtor = pg.Pool
  const probe = new pg.Pool({ connectionString: TEST_DB_URL, connectionTimeoutMillis: 2000 })
  await probe.query('SELECT 1')
  await probe.end()
  dbAvailable = true
} catch {
  dbAvailable = false
}
const describeDb = dbAvailable ? describe : describe.skip

const USERS = 'restore_test_users'
const ORDERS = 'restore_test_orders'
const EMPTY = 'restore_test_empty'

describeDb('audit F2 (3.4.96): live restore from a synthetic dump', () => {
  const tmpDir = resolve(root, 'tests', '.tmp-restore-test')
  let pool: {
    query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>
    end: () => Promise<void>
  }

  async function resetTables() {
    await pool.query(`DROP TABLE IF EXISTS ${EMPTY}, ${ORDERS}, ${USERS}`)
    await pool.query(`CREATE TABLE ${USERS} (id SERIAL PRIMARY KEY, name TEXT NOT NULL, payload BYTEA)`)
    await pool.query(`CREATE TABLE ${ORDERS} (id SERIAL PRIMARY KEY, user_id INT NOT NULL, total INT NOT NULL)`)
    await pool.query(`CREATE TABLE ${EMPTY} (id SERIAL PRIMARY KEY, note TEXT)`)
    // Stale rows the restore must wipe via TRUNCATE — including one in the
    // table the dump has zero rows for.
    await pool.query(`INSERT INTO ${USERS} (id, name) VALUES (900, 'Stale')`)
    await pool.query(`INSERT INTO ${ORDERS} (id, user_id, total) VALUES (900, 900, 1)`)
    await pool.query(`INSERT INTO ${EMPTY} (id, note) VALUES (900, 'stale')`)
  }

  function dumpFile(name: string, manifest: Record<string, unknown>, rows: { t: string; r: Record<string, unknown> }[]) {
    const lines = [JSON.stringify(manifest), ...rows.map((row) => JSON.stringify(row))]
    return { path: resolve(tmpDir, name), body: gzipSync(lines.join('\n') + '\n') }
  }

  const manifestTables = [
    { name: USERS, rows: 2 },
    { name: ORDERS, rows: 3 },
    { name: EMPTY, rows: 0 },
  ]
  const dumpRows = [
    { t: USERS, r: { id: 1, name: 'Alice', payload: Buffer.from('hello') } },
    { t: USERS, r: { id: 2, name: 'Bob', payload: null } },
    { t: ORDERS, r: { id: 10, user_id: 1, total: 100 } },
    { t: ORDERS, r: { id: 11, user_id: 1, total: 50 } },
    { t: ORDERS, r: { id: 12, user_id: 2, total: 75 } },
  ]

  beforeAll(async () => {
    pool = new PoolCtor!({ connectionString: TEST_DB_URL })
    await mkdir(tmpDir, { recursive: true })
  })

  afterAll(async () => {
    await pool.query(`DROP TABLE IF EXISTS ${EMPTY}, ${ORDERS}, ${USERS}`)
    await pool.end()
    await rm(tmpDir, { recursive: true, force: true })
  })

  beforeEach(async () => {
    await resetTables()
  })

  it('restores rows, truncates the zero-row table, replays recorded sequences', async () => {
    const manifest = {
      _manifest: true,
      dumpedAt: '2026-11-11T00:00:00.000Z',
      retentionDays: 10,
      appVersion: '3.4.95',
      tables: manifestTables,
      sequences: [
        { table: USERS, sequence: `${USERS}_id_seq`, column: 'id', lastValue: 2, isCalled: true },
        { table: ORDERS, sequence: `${ORDERS}_id_seq`, column: 'id', lastValue: 12, isCalled: true },
      ],
    }
    const { path, body } = dumpFile('modern.jsonl.gz', manifest, dumpRows)
    await writeFile(path, body)

    const { code, stdout, stderr } = await runScript([path], { DATABASE_URL: TEST_DB_URL })
    expect(stderr).not.toContain('Restore failed')
    expect(code).toBe(0)
    expect(stdout).toContain('✓ Restored 5 rows into 3 tables')

    const users = await pool.query(`SELECT id, name, payload FROM ${USERS} ORDER BY id`)
    expect(users.rows).toHaveLength(2)
    expect(users.rows[0].name).toBe('Alice')
    expect(Buffer.from(users.rows[0].payload as Uint8Array).toString('utf8')).toBe('hello')
    expect(users.rows[1].name).toBe('Bob')
    const orders = await pool.query(`SELECT id, user_id, total FROM ${ORDERS} ORDER BY id`)
    expect(orders.rows).toHaveLength(3)
    expect(orders.rows.map((r) => r.id)).toEqual([10, 11, 12])
    // Zero-row table in the manifest: its stale row must be gone.
    const empty = await pool.query(`SELECT COUNT(*)::int AS c FROM ${EMPTY}`)
    expect(empty.rows[0].c).toBe(0)

    // Recorded sequence positions replayed: the next auto-id continues
    // from the dump, it does not collide with the restored rows.
    const next = await pool.query(`INSERT INTO ${USERS} (name) VALUES ('Next') RETURNING id`)
    expect(next.rows[0].id).toBe(3)
    const nextOrder = await pool.query(`INSERT INTO ${ORDERS} (user_id, total) VALUES (1, 1) RETURNING id`)
    expect(nextOrder.rows[0].id).toBe(13)
  }, 60_000)

  it('legacy manifest without sequences falls back to MAX(id)', async () => {
    const manifest = {
      _manifest: true,
      dumpedAt: '2026-11-11T00:00:00.000Z',
      retentionDays: 10,
      tables: manifestTables,
      // No `sequences` field at all — pre-A18 dump.
    }
    const { path, body } = dumpFile('legacy.jsonl.gz', manifest, dumpRows)
    await writeFile(path, body)

    const { code, stdout, stderr } = await runScript([path], { DATABASE_URL: TEST_DB_URL })
    expect(stderr).not.toContain('Restore failed')
    expect(code).toBe(0)
    expect(stdout).toContain('legacy manifest, no recorded positions')
    expect(stdout).toContain('✓ Restored 5 rows into 3 tables')

    const users = await pool.query(`SELECT id FROM ${USERS} ORDER BY id`)
    expect(users.rows.map((r) => r.id)).toEqual([1, 2])
    const empty = await pool.query(`SELECT COUNT(*)::int AS c FROM ${EMPTY}`)
    expect(empty.rows[0].c).toBe(0)

    const next = await pool.query(`INSERT INTO ${USERS} (name) VALUES ('Next') RETURNING id`)
    expect(next.rows[0].id).toBe(3)
  }, 60_000)

  it('manifest without a table list restores via the pre-scan fallback', async () => {
    const manifest = {
      _manifest: true,
      dumpedAt: '2026-11-11T00:00:00.000Z',
      retentionDays: 10,
      // No `tables` and no `sequences` — older than any known dump.
    }
    const { path, body } = dumpFile('no-tables.jsonl.gz', manifest, dumpRows)
    await writeFile(path, body)

    const { code, stdout, stderr } = await runScript([path], { DATABASE_URL: TEST_DB_URL })
    expect(stderr).not.toContain('Restore failed')
    expect(code).toBe(0)
    expect(stdout).toContain('✓ Restored 5 rows into 2 tables')

    const users = await pool.query(`SELECT id FROM ${USERS} ORDER BY id`)
    expect(users.rows.map((r) => r.id)).toEqual([1, 2])
    const orders = await pool.query(`SELECT COUNT(*)::int AS c FROM ${ORDERS}`)
    expect(orders.rows[0].c).toBe(3)
  }, 60_000)
})
