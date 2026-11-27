import { describe, expect, it, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { gzipSync, gunzipSync } from 'node:zlib'
import { randomBytes } from 'node:crypto'
import {
  BACKUP_MAGIC,
  BackupDecryptStream,
  BackupEncryptStream,
  currentBackupKey,
  currentBackupKeyId,
  decodeBackupHeader,
  decryptBackupBytes,
  encodeBackupHeader,
  encryptBackupBytes,
  isEncryptedBackupMagic,
  resolveBackupKey,
} from '@/lib/shop/backup-crypto'

// Backup encryption (3.4.109): AES-256-GCM, compress-then-encrypt.
// Unit tests cover the shared helper (lib/shop/backup-crypto.ts); the
// writer tests cover runDatabaseBackup end-to-end against a mocked pool;
// the live tests restore encrypted + legacy dumps with the real
// scripts/db-restore-backup.mjs subprocess against the scratch DB — which
// also cross-checks the .mjs decrypt implementation against this TS one
// (the script cannot import the TS module, so the format is implemented
// twice; a drift between them fails the live restore tests here).

const root = resolve(import.meta.dirname, '..')
const SCRIPT = resolve(root, 'scripts/db-restore-backup.mjs')

// Fresh random keys per run: the tests must never depend on a fixed key,
// and no test key is ever written to the repo (only to temp files / env).
const KEY_ID = '2026-11'
const KEY = randomBytes(32)
const KEY_B64 = KEY.toString('base64')
const OTHER_KEY_B64 = randomBytes(32).toString('base64')

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

describe('backup-crypto: header encode/decode', () => {
  it('round-trips the header and reports its byte length', () => {
    const nonce = randomBytes(12)
    const encoded = encodeBackupHeader({ v: 1, alg: 'aes-256-gcm', keyId: KEY_ID, nonce: nonce.toString('base64') })
    expect(encoded.subarray(0, 8).toString('ascii')).toBe(BACKUP_MAGIC)
    expect(encoded.readUInt16BE(8)).toBe(encoded.length - 10)
    const { header, headerLength } = decodeBackupHeader(encoded)
    expect(header).toEqual({ v: 1, alg: 'aes-256-gcm', keyId: KEY_ID, nonce: nonce.toString('base64') })
    expect(headerLength).toBe(encoded.length)
  })

  it('detects the magic and rejects anything else', () => {
    const encoded = encodeBackupHeader({ v: 1, alg: 'aes-256-gcm', keyId: KEY_ID, nonce: randomBytes(12).toString('base64') })
    expect(isEncryptedBackupMagic(encoded)).toBe(true)
    expect(isEncryptedBackupMagic(Buffer.from('not a backup at all'))).toBe(false)
    expect(isEncryptedBackupMagic(Buffer.alloc(0))).toBe(false)
    expect(() => decodeBackupHeader(Buffer.from('not a backup at all'))).toThrow(/does not start with the encrypted-backup magic/)
    expect(() => decodeBackupHeader(encoded.subarray(0, 12))).toThrow(/truncated backup header/)
  })

  it('rejects a header with a wrong version / algorithm', () => {
    const bad = Buffer.concat([
      Buffer.from(BACKUP_MAGIC, 'ascii'),
      Buffer.from([0, 0]),
    ])
    const json = Buffer.from(JSON.stringify({ v: 2, alg: 'aes-256-gcm', keyId: KEY_ID, nonce: randomBytes(12).toString('base64') }), 'utf8')
    bad.writeUInt16BE(json.length, 8)
    expect(() => decodeBackupHeader(Buffer.concat([bad, json]))).toThrow(/unsupported encrypted-backup header/)
  })
})

describe('backup-crypto: key resolution', () => {
  const env = { BACKUP_ENCRYPTION_KEY: KEY_B64, BACKUP_ENCRYPTION_KEY_ID: KEY_ID }

  it('resolves the current key when the keyId is the current id', () => {
    expect(resolveBackupKey(KEY_ID, env)).toEqual(KEY)
    expect(currentBackupKeyId(env)).toBe(KEY_ID)
    expect(currentBackupKey(env)).toEqual({ key: KEY, keyId: KEY_ID })
  })

  it('prefers a retained old key over the current key', () => {
    const old = randomBytes(32)
    const e = { ...env, [`BACKUP_ENCRYPTION_KEY_${KEY_ID}`]: old.toString('base64') }
    expect(resolveBackupKey(KEY_ID, e)).toEqual(old)
  })

  it('resolves a retained key when the current key is a different one', () => {
    const e = {
      BACKUP_ENCRYPTION_KEY: OTHER_KEY_B64,
      BACKUP_ENCRYPTION_KEY_ID: '2026-12',
      [`BACKUP_ENCRYPTION_KEY_${KEY_ID}`]: KEY_B64,
    }
    expect(resolveBackupKey(KEY_ID, e)).toEqual(KEY)
  })

  it('unknown keyId → clear error naming the keyId and its env var', () => {
    expect(() => resolveBackupKey('1999-01', env)).toThrow(/Unknown backup keyId "1999-01"/)
    expect(() => resolveBackupKey('1999-01', env)).toThrow(/BACKUP_ENCRYPTION_KEY_1999-01/)
  })

  it('fails closed when the current key is unset or malformed', () => {
    expect(() => currentBackupKey({})).toThrow(/BACKUP_ENCRYPTION_KEY is not set/)
    expect(() => currentBackupKey({ BACKUP_ENCRYPTION_KEY: 'aGVsbG8=' })).toThrow(/must decode to 32 bytes/)
    expect(() => currentBackupKey({ BACKUP_ENCRYPTION_KEY: '!!!not-base64!!!' })).toThrow(/not valid base64/)
  })
})

describe('backup-crypto: encrypt/decrypt round-trip', () => {
  const plain = Buffer.from('{"_manifest":true}\n{"t":"t1","r":{"id":1,"name":"a"}}\n', 'utf8')

  it('encrypt → decrypt → identical bytes (byte helpers)', async () => {
    const env = { BACKUP_ENCRYPTION_KEY: KEY_B64, BACKUP_ENCRYPTION_KEY_ID: KEY_ID }
    const encrypted = await encryptBackupBytes(plain, KEY, KEY_ID)
    expect(isEncryptedBackupMagic(encrypted)).toBe(true)
    expect(encrypted.length).toBeGreaterThan(plain.length)
    await expect(decryptBackupBytes(encrypted, env)).resolves.toEqual(plain)
  })

  it('encrypt → decrypt → identical bytes (streams, chunked writes)', async () => {
    const { Readable } = await import('node:stream')
    const chunks: Buffer[] = []
    const encrypted = await new Promise<Buffer>((resolvePromise, reject) => {
      const enc = new BackupEncryptStream(KEY, KEY_ID)
      enc.on('data', (c: Buffer) => chunks.push(c))
      enc.on('end', () => resolvePromise(Buffer.concat(chunks)))
      enc.on('error', reject)
      // Split the input across several small writes, like a streaming writer.
      enc.write(plain.subarray(0, 10))
      enc.write(plain.subarray(10, 30))
      enc.end(plain.subarray(30))
    })
    const { header, headerLength } = decodeBackupHeader(encrypted)
    expect(header.keyId).toBe(KEY_ID)
    const out: Buffer[] = []
    await new Promise<void>((resolvePromise, reject) => {
      const dec = new BackupDecryptStream(KEY, Buffer.from(header.nonce, 'base64'))
      dec.on('data', (c: Buffer) => out.push(c))
      dec.on('end', () => resolvePromise())
      dec.on('error', reject)
      const cipher = encrypted.subarray(headerLength)
      dec.write(cipher.subarray(0, 7))
      dec.end(cipher.subarray(7))
    })
    expect(Buffer.concat(out)).toEqual(plain)
    // Two backups of the same bytes differ (fresh random nonce each time).
    const again = await encryptBackupBytes(plain, KEY, KEY_ID)
    expect(again.equals(encrypted)).toBe(false)
    expect(Readable).toBeDefined()
  })

  it('wrong key → tag failure', async () => {
    const encrypted = await encryptBackupBytes(plain, KEY, KEY_ID)
    const env = { BACKUP_ENCRYPTION_KEY: OTHER_KEY_B64, BACKUP_ENCRYPTION_KEY_ID: KEY_ID }
    await expect(decryptBackupBytes(encrypted, env)).rejects.toThrow(/authenticate data/)
  })

  it('tampered ciphertext byte → tag failure', async () => {
    const encrypted = await encryptBackupBytes(plain, KEY, KEY_ID)
    const { headerLength } = decodeBackupHeader(encrypted)
    const tampered = Buffer.from(encrypted)
    tampered[headerLength + 5] ^= 0xff
    const env = { BACKUP_ENCRYPTION_KEY: KEY_B64, BACKUP_ENCRYPTION_KEY_ID: KEY_ID }
    await expect(decryptBackupBytes(tampered, env)).rejects.toThrow(/authenticate data/)
  })

  it('tampered tag byte → tag failure', async () => {
    const encrypted = await encryptBackupBytes(plain, KEY, KEY_ID)
    const tampered = Buffer.from(encrypted)
    tampered[tampered.length - 1] ^= 0xff
    const env = { BACKUP_ENCRYPTION_KEY: KEY_B64, BACKUP_ENCRYPTION_KEY_ID: KEY_ID }
    await expect(decryptBackupBytes(tampered, env)).rejects.toThrow(/authenticate data/)
  })

  it('truncated file (tag cut off) → clear error, not silent plaintext', async () => {
    const encrypted = await encryptBackupBytes(plain, KEY, KEY_ID)
    const env = { BACKUP_ENCRYPTION_KEY: KEY_B64, BACKUP_ENCRYPTION_KEY_ID: KEY_ID }
    await expect(decryptBackupBytes(encrypted.subarray(0, encrypted.length - 5), env)).rejects.toThrow(/truncated|authenticate/i)
  })
})

// ── Writer tests (mocked pool, same shape as tests/db-backup-streaming.test.ts) ──
const { mockPool, mockReportError } = vi.hoisted(() => ({
  mockPool: { connect: vi.fn() },
  mockReportError: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ pool: mockPool }))
vi.mock('@/lib/server-errors', () => ({ reportError: mockReportError }))

const tables: Record<string, Record<string, unknown>[]> = {
  t1: [
    { id: 1, name: 'a' },
    { id: 2, name: 'b' },
    { id: 3, name: 'c' },
  ],
  t2: [],
}
let countOverride: Record<string, number> | null = null

function makeClient() {
  let cursor: { table: string; pos: number } | null = null
  return {
    release: vi.fn(),
    query: vi.fn(async (text: string) => {
      if (/BEGIN|COMMIT|ROLLBACK|SET TRANSACTION/i.test(text)) return { rows: [] }
      if (/FROM pg_tables/.test(text)) {
        return { rows: Object.keys(tables).map((t) => ({ tablename: t })) }
      }
      if (/COUNT\(\*\)/.test(text)) {
        const t = text.match(/FROM "([^"]+)"/)?.[1] ?? ''
        const c = countOverride?.[t] ?? tables[t]?.length ?? 0
        return { rows: [{ c }] }
      }
      if (/information_schema\.columns/.test(text)) {
        return { rows: [{ table_name: 't1', column_name: 'id' }] }
      }
      if (/pg_get_serial_sequence\(\$1, \$2\)/.test(text)) {
        return { rows: [{ seq: 'public.t1_id_seq' }] }
      }
      if (/last_value/.test(text)) return { rows: [{ last_value: '3', is_called: true }] }
      if (/schema_migrations/.test(text)) return { rows: [{ migrate_sql_sha256: 'abc123' }] }
      if (/^DECLARE \w+ CURSOR FOR SELECT \* FROM "([^"]+)" ORDER BY ctid/i.test(text)) {
        cursor = { table: text.match(/FROM "([^"]+)"/)?.[1] ?? '', pos: 0 }
        return { rows: [] }
      }
      if (/^FETCH (\d+) FROM \w+/i.test(text)) {
        const n = Number(text.match(/^FETCH (\d+)/i)?.[1] ?? 0)
        const t = cursor?.table ?? ''
        const pos = cursor?.pos ?? 0
        const rows = (tables[t] ?? []).slice(pos, pos + n)
        if (cursor) cursor.pos += rows.length
        return { rows }
      }
      if (/^CLOSE \w+/i.test(text)) {
        cursor = null
        return { rows: [] }
      }
      return { rows: [] }
    }),
  }
}

const savedEnv: Record<string, string | undefined> = {}
function setWriterEnv(dir: string, withKey: boolean) {
  for (const k of ['BACKUP_DIR', 'BACKUP_ENCRYPTION_KEY', 'BACKUP_ENCRYPTION_KEY_ID', `BACKUP_ENCRYPTION_KEY_${KEY_ID}`]) {
    if (!(k in savedEnv)) savedEnv[k] = process.env[k]
  }
  process.env.BACKUP_DIR = dir
  if (withKey) {
    process.env.BACKUP_ENCRYPTION_KEY = KEY_B64
    process.env.BACKUP_ENCRYPTION_KEY_ID = KEY_ID
  } else {
    delete process.env.BACKUP_ENCRYPTION_KEY
    delete process.env.BACKUP_ENCRYPTION_KEY_ID
    delete process.env[`BACKUP_ENCRYPTION_KEY_${KEY_ID}`]
  }
}
function restoreWriterEnv() {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
}

describe('runDatabaseBackup writes an encrypted backup (3.4.109)', () => {
  let dir = ''

  async function loadBackupModule() {
    dir = await mkdtemp(join(tmpdir(), 'db-backup-enc-test-'))
    setWriterEnv(dir, true)
    vi.resetModules()
    return import('@/lib/shop/db-backup')
  }

  afterEach(async () => {
    countOverride = null
    mockReportError.mockClear()
    restoreWriterEnv()
    if (dir) await rm(dir, { recursive: true, force: true })
    dir = ''
  })

  it('writes .jsonl.gz.enc, 0600, no .tmp left; decrypts to the same dump', async () => {
    mockPool.connect.mockImplementation(async () => makeClient())
    const mod = await loadBackupModule()
    const summary = await mod.runDatabaseBackup(new Date(Date.UTC(2026, 9, 1, 0, 30, 5)))

    expect(summary.tables).toBe(2)
    expect(summary.rows).toBe(3)
    expect(summary.bytes).toBeGreaterThan(0)
    expect(summary.pathname).toBe(join(dir, '2026-10-01-003005.jsonl.gz.enc'))
    expect(await readdir(dir)).toEqual(['2026-10-01-003005.jsonl.gz.enc'])
    expect((await stat(summary.pathname)).mode & 0o777).toBe(0o600)

    const encrypted = await readFile(summary.pathname)
    expect(isEncryptedBackupMagic(encrypted)).toBe(true)
    const { header } = decodeBackupHeader(encrypted)
    expect(header.keyId).toBe(KEY_ID)
    const text = gunzipSync(
      await decryptBackupBytes(encrypted, { BACKUP_ENCRYPTION_KEY: KEY_B64, BACKUP_ENCRYPTION_KEY_ID: KEY_ID }),
    ).toString('utf8')
    const lines = text.split('\n').filter((l) => l.length > 0)
    expect(JSON.parse(lines[0])._manifest).toBe(true)
    expect(lines.slice(1).map((l) => JSON.parse(l))).toEqual([
      { t: 't1', r: { id: 1, name: 'a' } },
      { t: 't1', r: { id: 2, name: 'b' } },
      { t: 't1', r: { id: 3, name: 'c' } },
    ])
  })

  it('fails closed without BACKUP_ENCRYPTION_KEY — nothing written', async () => {
    mockPool.connect.mockImplementation(async () => makeClient())
    dir = await mkdtemp(join(tmpdir(), 'db-backup-enc-test-'))
    setWriterEnv(dir, false)
    vi.resetModules()
    const mod = await import('@/lib/shop/db-backup')
    await expect(mod.runDatabaseBackup(new Date(Date.UTC(2026, 9, 1, 0, 30, 5)))).rejects.toThrow(
      /BACKUP_ENCRYPTION_KEY is not set/,
    )
    expect(await readdir(dir)).toEqual([])
  })

  it('prune matches both suffixes during the transition', async () => {
    const mod = await loadBackupModule()
    const now = new Date(Date.UTC(2026, 9, 11, 12, 0))
    // Pure function: stale .enc + stale .gz pruned, fresh .enc kept.
    expect(
      mod.backupsToDelete(
        ['2026-10-01-003000.jsonl.gz.enc', '2026-10-01-003000.jsonl.gz', '2026-10-05-003000.jsonl.gz.enc'],
        now,
        mod.BACKUP_RETENTION_DAYS,
      ),
    ).toEqual(['2026-10-01-003000.jsonl.gz.enc', '2026-10-01-003000.jsonl.gz'])
    // Integration: pruneOldBackups deletes stale files of both kinds.
    await writeFile(join(dir, '2026-10-01-003000.jsonl.gz.enc'), 'x')
    await writeFile(join(dir, '2026-10-01-003000.jsonl.gz'), 'x')
    await writeFile(join(dir, '2026-10-05-003000.jsonl.gz.enc'), 'x')
    expect(await mod.pruneOldBackups(now, mod.BACKUP_RETENTION_DAYS)).toEqual({ pruned: 2, failed: 0 })
    expect((await readdir(dir)).sort()).toEqual(['2026-10-05-003000.jsonl.gz.enc'])
  })
})

// ── Restore CLI tests that need no live DB (fail before any connection) ──
const hasNodeModules = existsSync(resolve(root, 'node_modules', 'pg', 'package.json'))
const describeCli = hasNodeModules ? describe : describe.skip

describeCli('restore script: format mismatch + unknown keyId (no DB needed)', () => {
  const tmpDir = resolve(root, 'tests', '.tmp-backup-encryption-test')
  const baseEnv = { DATABASE_URL: 'postgresql://techno:techno-local-test@127.0.0.1:5432/techno_store_3109' }

  beforeAll(async () => {
    await mkdir(tmpDir, { recursive: true })
  })
  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('.enc extension without the magic errors out (mismatch)', async () => {
    const path = resolve(tmpDir, 'plain-as-enc.jsonl.gz.enc')
    await writeFile(path, gzipSync('{"_manifest":true}\n'))
    const { code, stdout, stderr } = await runScript([path], { ...baseEnv, BACKUP_ENCRYPTION_KEY: KEY_B64 })
    const out = stdout + stderr
    expect(code).not.toBe(0)
    expect(out).toContain('no encrypted-backup magic')
  })

  it('encrypted bytes with a .jsonl.gz name error out (mismatch)', async () => {
    const path = resolve(tmpDir, 'enc-as-plain.jsonl.gz')
    const enc = await encryptBackupBytes(gzipSync('{"_manifest":true}\n'), KEY, KEY_ID)
    await writeFile(path, enc)
    const { code, stdout, stderr } = await runScript([path], { ...baseEnv, BACKUP_ENCRYPTION_KEY: KEY_B64 })
    const out = stdout + stderr
    expect(code).not.toBe(0)
    expect(out).toContain('does not end in .jsonl.gz.enc')
  })

  it('unknown keyId → clear error naming the keyId and its env var', async () => {
    const path = resolve(tmpDir, 'unknown-key.jsonl.gz.enc')
    const enc = await encryptBackupBytes(gzipSync('{"_manifest":true}\n'), KEY, '1999-01')
    await writeFile(path, enc)
    const { code, stdout, stderr } = await runScript([path], {
      ...baseEnv,
      BACKUP_ENCRYPTION_KEY: KEY_B64,
      BACKUP_ENCRYPTION_KEY_ID: KEY_ID,
    })
    const out = stdout + stderr
    expect(code).not.toBe(0)
    expect(out).toContain('Unknown backup keyId "1999-01"')
    expect(out).toContain('BACKUP_ENCRYPTION_KEY_1999-01')
  })

  it('never accepts the key from a CLI argument', () => {
    const script = readFileSync(SCRIPT, 'utf8')
    expect(script).not.toMatch(/process\.argv\[[34]\]/)
    expect(script).toContain('BACKUP_ENCRYPTION_KEY')
  })
})

// ── Live restore tests (scratch DB, skip when no server answers) ──
const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://techno:techno-local-test@127.0.0.1:5432/techno_store_3109'

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

const USERS = 'restore_enc_users'
const ORDERS = 'restore_enc_orders'
const EMPTY = 'restore_enc_empty'

describeDb('live restore of encrypted + legacy backups (scratch DB)', () => {
  const tmpDir = resolve(root, 'tests', '.tmp-backup-encryption-test')
  let pool: {
    query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>
    end: () => Promise<void>
  }

  async function resetTables() {
    await pool.query(`DROP TABLE IF EXISTS ${EMPTY}, ${ORDERS}, ${USERS}`)
    await pool.query(`CREATE TABLE ${USERS} (id SERIAL PRIMARY KEY, name TEXT NOT NULL, payload BYTEA)`)
    await pool.query(`CREATE TABLE ${ORDERS} (id SERIAL PRIMARY KEY, user_id INT NOT NULL, total INT NOT NULL)`)
    await pool.query(`CREATE TABLE ${EMPTY} (id SERIAL PRIMARY KEY, note TEXT)`)
    // Stale rows the restore must wipe via TRUNCATE.
    await pool.query(`INSERT INTO ${USERS} (id, name) VALUES (900, 'Stale')`)
    await pool.query(`INSERT INTO ${ORDERS} (id, user_id, total) VALUES (900, 900, 1)`)
    await pool.query(`INSERT INTO ${EMPTY} (id, note) VALUES (900, 'stale')`)
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
  const manifest = {
    _manifest: true,
    dumpedAt: '2026-11-27T00:00:00.000Z',
    retentionDays: 10,
    appVersion: '3.4.109',
    tables: manifestTables,
    sequences: [
      { table: USERS, sequence: `${USERS}_id_seq`, column: 'id', lastValue: 2, isCalled: true },
      { table: ORDERS, sequence: `${ORDERS}_id_seq`, column: 'id', lastValue: 12, isCalled: true },
    ],
  }

  function dumpBody() {
    const lines = [JSON.stringify(manifest), ...dumpRows.map((row) => JSON.stringify(row))]
    return gzipSync(lines.join('\n') + '\n')
  }

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

  it('restores an encrypted backup: rows, truncated zero-row table, sequences', async () => {
    const path = resolve(tmpDir, 'enc.jsonl.gz.enc')
    await writeFile(path, await encryptBackupBytes(dumpBody(), KEY, KEY_ID))

    const { code, stdout, stderr } = await runScript([path], {
      DATABASE_URL: TEST_DB_URL,
      BACKUP_ENCRYPTION_KEY: KEY_B64,
      BACKUP_ENCRYPTION_KEY_ID: KEY_ID,
    })
    expect(stderr).not.toContain('Restore failed')
    expect(code).toBe(0)
    expect(stdout).toContain('✓ Restored 5 rows into 3 tables')

    const users = await pool.query(`SELECT id, name, payload FROM ${USERS} ORDER BY id`)
    expect(users.rows).toHaveLength(2)
    expect(users.rows[0].name).toBe('Alice')
    expect(Buffer.from(users.rows[0].payload as Uint8Array).toString('utf8')).toBe('hello')
    const orders = await pool.query(`SELECT id, user_id, total FROM ${ORDERS} ORDER BY id`)
    expect(orders.rows).toHaveLength(3)
    expect(orders.rows.map((r) => r.id)).toEqual([10, 11, 12])
    const empty = await pool.query(`SELECT COUNT(*)::int AS c FROM ${EMPTY}`)
    expect(empty.rows[0].c).toBe(0)
    const next = await pool.query(`INSERT INTO ${USERS} (name) VALUES ('Next') RETURNING id`)
    expect(next.rows[0].id).toBe(3)
  }, 60_000)

  it('restores a legacy plaintext backup unchanged (no key needed)', async () => {
    const path = resolve(tmpDir, 'legacy.jsonl.gz')
    await writeFile(path, dumpBody())

    const { code, stdout, stderr } = await runScript([path], { DATABASE_URL: TEST_DB_URL })
    expect(stderr).not.toContain('Restore failed')
    expect(code).toBe(0)
    expect(stdout).toContain('✓ Restored 5 rows into 3 tables')

    const users = await pool.query(`SELECT id FROM ${USERS} ORDER BY id`)
    expect(users.rows.map((r) => r.id)).toEqual([1, 2])
    const empty = await pool.query(`SELECT COUNT(*)::int AS c FROM ${EMPTY}`)
    expect(empty.rows[0].c).toBe(0)
  }, 60_000)

  it('restores with a retained old key when the current key is a different one', async () => {
    const path = resolve(tmpDir, 'rotated.jsonl.gz.enc')
    await writeFile(path, await encryptBackupBytes(dumpBody(), KEY, KEY_ID))

    const { code, stdout, stderr } = await runScript([path], {
      DATABASE_URL: TEST_DB_URL,
      BACKUP_ENCRYPTION_KEY: OTHER_KEY_B64,
      BACKUP_ENCRYPTION_KEY_ID: '2026-12',
      [`BACKUP_ENCRYPTION_KEY_${KEY_ID}`]: KEY_B64,
    })
    expect(stderr).not.toContain('Restore failed')
    expect(code).toBe(0)
    expect(stdout).toContain('✓ Restored 5 rows into 3 tables')
    const users = await pool.query(`SELECT id FROM ${USERS} ORDER BY id`)
    expect(users.rows.map((r) => r.id)).toEqual([1, 2])
  }, 60_000)

  it('tampered encrypted backup → restore refuses and the DB is unchanged', async () => {
    const path = resolve(tmpDir, 'tampered.jsonl.gz.enc')
    const enc = await encryptBackupBytes(dumpBody(), KEY, KEY_ID)
    const tampered = Buffer.from(enc)
    // Flip a ciphertext byte near the end (after the manifest + early rows,
    // so the restore is already inside its transaction when it fails).
    tampered[tampered.length - 20] ^= 0xff
    await writeFile(path, tampered)

    const { code, stdout, stderr } = await runScript([path], {
      DATABASE_URL: TEST_DB_URL,
      BACKUP_ENCRYPTION_KEY: KEY_B64,
      BACKUP_ENCRYPTION_KEY_ID: KEY_ID,
    })
    const out = stdout + stderr
    expect(code).not.toBe(0)
    expect(out).toMatch(/Restore failed|authenticate data|incorrect (data|length|header) check|invalid/i)

    // Nothing half-applied: the stale rows the restore would have
    // TRUNCATEd away are still there, and no dump row landed.
    const users = await pool.query(`SELECT id, name FROM ${USERS} ORDER BY id`)
    expect(users.rows).toEqual([{ id: 900, name: 'Stale' }])
    const orders = await pool.query(`SELECT id FROM ${ORDERS} ORDER BY id`)
    expect(orders.rows.map((r) => r.id)).toEqual([900])
    const empty = await pool.query(`SELECT COUNT(*)::int AS c FROM ${EMPTY}`)
    expect(empty.rows[0].c).toBe(1)
  }, 60_000)

  it('wrong key → restore refuses and the DB is unchanged', async () => {
    const path = resolve(tmpDir, 'wrong-key.jsonl.gz.enc')
    await writeFile(path, await encryptBackupBytes(dumpBody(), KEY, KEY_ID))

    const { code, stdout, stderr } = await runScript([path], {
      DATABASE_URL: TEST_DB_URL,
      BACKUP_ENCRYPTION_KEY: OTHER_KEY_B64,
      BACKUP_ENCRYPTION_KEY_ID: KEY_ID,
    })
    const out = stdout + stderr
    expect(code).not.toBe(0)
    expect(out).toMatch(/Restore failed|authenticate data/i)
    const users = await pool.query(`SELECT id, name FROM ${USERS} ORDER BY id`)
    expect(users.rows).toEqual([{ id: 900, name: 'Stale' }])
  }, 60_000)
})
