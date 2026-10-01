/**
 * DB migration runner for the admin "Check DB version" button (/admin/updates).
 *
 * The bundled db/migrate.sql (see lib/db/migrate-bundle.ts, generated from
 * db/migrate.sql) is fully idempotent — every statement uses IF NOT EXISTS.
 * Instead of tracking hundreds of individual statements, we track one version
 * marker: the SHA-256 of the bundled migration SQL, stored in the
 * `schema_migrations` table (single row, id = 1).
 *
 * - getMigrationStatus(): compares the stored hash with the bundled one.
 * - applyMigrations(): splits the SQL into statements (dollar-quote aware),
 *   runs them one by one, then records the new hash. Idempotent — safe to
 *   re-run; a failed run can simply be retried.
 *
 * Server-only: imports the pg pool.
 */
import { createHash } from 'node:crypto'
import { pool } from '@/lib/db'
import { MIGRATE_SQL } from '@/lib/db/migrate-bundle'

export type MigrationStatus = {
  ok: boolean
  /** sha256 of the bundled migrate.sql */
  currentVersion: string
  /** sha256 recorded in the DB (null = never applied via this tool) */
  appliedVersion: string | null
  appliedAt: string | null
  upToDate: boolean
  statementCount: number
  error?: string
}

export type MigrationApplyResult = {
  ok: boolean
  applied: number
  total: number
  version: string
  error?: string
}

const MIGRATIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  id integer PRIMARY KEY,
  migrate_sql_sha256 varchar(64) NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT schema_migrations_single_row CHECK (id = 1)
)`.trim()

export function migrationSqlHash(): string {
  return createHash('sha256').update(MIGRATE_SQL, 'utf8').digest('hex')
}

/**
 * Split SQL into individual statements. Aware of:
 * - line comments (-- ...) and block comments (/* ... *\/)
 * - single-quoted strings with '' escapes
 * - dollar-quoted strings ($$ ... $$, $tag$ ... $tag$)
 */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ''
  let i = 0
  const n = sql.length
  while (i < n) {
    const ch = sql[i]
    // Line comment: consume to end of line (semicolons inside don't split).
    if (ch === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i)
      const next = end === -1 ? n : end
      current += sql.slice(i, next)
      i = next
      continue
    }
    // Block comment.
    if (ch === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2)
      const next = end === -1 ? n : end + 2
      current += sql.slice(i, next)
      i = next
      continue
    }
    // Single-quoted string literal.
    if (ch === "'") {
      let j = i + 1
      while (j < n) {
        if (sql[j] === "'") {
          if (sql[j + 1] === "'") {
            j += 2
            continue
          }
          j += 1
          break
        }
        j += 1
      }
      current += sql.slice(i, j)
      i = j
      continue
    }
    // Dollar-quoted string: $$...$$ or $tag$...$tag$.
    if (ch === '$') {
      const m = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(sql.slice(i, i + 32))
      if (m) {
        const tag = m[0]
        const end = sql.indexOf(tag, i + tag.length)
        const next = end === -1 ? n : end + tag.length
        current += sql.slice(i, next)
        i = next
        continue
      }
      current += ch
      i += 1
      continue
    }
    if (ch === ';') {
      const stmt = current.trim()
      if (stmt) statements.push(stmt)
      current = ''
      i += 1
      continue
    }
    current += ch
    i += 1
  }
  const tail = current.trim()
  if (tail) statements.push(tail)
  return statements
}

export async function getMigrationStatus(): Promise<MigrationStatus> {
  const currentVersion = migrationSqlHash()
  const statementCount = splitSqlStatements(MIGRATE_SQL).length
  try {
    await pool.query(MIGRATIONS_TABLE_SQL)
    const { rows } = await pool.query<{ migrate_sql_sha256: string; applied_at: Date }>(
      'SELECT migrate_sql_sha256, applied_at FROM schema_migrations WHERE id = 1',
    )
    const row = rows[0]
    const appliedVersion = row?.migrate_sql_sha256 ?? null
    return {
      ok: true,
      currentVersion,
      appliedVersion,
      appliedAt: row ? new Date(row.applied_at).toISOString() : null,
      upToDate: appliedVersion === currentVersion,
      statementCount,
    }
  } catch (err) {
    return {
      ok: false,
      currentVersion,
      appliedVersion: null,
      appliedAt: null,
      upToDate: false,
      statementCount,
      error: (err as Error).message,
    }
  }
}

export async function applyMigrations(): Promise<MigrationApplyResult> {
  const version = migrationSqlHash()
  const statements = splitSqlStatements(MIGRATE_SQL)
  const client = await pool.connect()
  let applied = 0
  try {
    // Guard against a stuck DDL statement; reset before releasing the client.
    await client.query("SET statement_timeout = '120s'")
    await client.query(MIGRATIONS_TABLE_SQL)
    // Statements are idempotent (IF NOT EXISTS), so a failed run is safe to retry.
    for (const stmt of statements) {
      await client.query(stmt)
      applied += 1
    }
    await client.query(
      `INSERT INTO schema_migrations (id, migrate_sql_sha256, applied_at)
       VALUES (1, $1, now())
       ON CONFLICT (id) DO UPDATE SET migrate_sql_sha256 = EXCLUDED.migrate_sql_sha256, applied_at = now()`,
      [version],
    )
    return { ok: true, applied, total: statements.length, version }
  } catch (err) {
    return {
      ok: false,
      applied,
      total: statements.length,
      version,
      error: (err as Error).message,
    }
  } finally {
    try {
      await client.query('RESET statement_timeout')
    } catch {
      // Best effort — the client is released either way.
    }
    client.release()
  }
}
