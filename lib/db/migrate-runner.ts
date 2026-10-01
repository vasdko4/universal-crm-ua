import { createHash } from 'node:crypto'
import type { PoolClient } from 'pg'
import { pool } from '@/lib/db'
import { MIGRATE_SQL } from '@/lib/db/migrate-bundle'

export type MigrationStatus = {
  ok: boolean
  currentVersion: string
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function migrationSqlHash(): string {
  return createHash('sha256').update(MIGRATE_SQL, 'utf8').digest('hex')
}

export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ''
  let i = 0
  while (i < sql.length) {
    const ch = sql[i]
    if (ch === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i)
      const next = end === -1 ? sql.length : end
      current += sql.slice(i, next)
      i = next
      continue
    }
    if (ch === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2)
      const next = end === -1 ? sql.length : end + 2
      current += sql.slice(i, next)
      i = next
      continue
    }
    if (ch === "'") {
      let j = i + 1
      while (j < sql.length) {
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
    if (ch === '$') {
      const tagMatch = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(sql.slice(i, i + 32))
      if (tagMatch) {
        const tag = tagMatch[0]
        const end = sql.indexOf(tag, i + tag.length)
        const next = end === -1 ? sql.length : end + tag.length
        current += sql.slice(i, next)
        i = next
        continue
      }
    }
    if (ch === ';') {
      const statement = current.trim()
      if (statement) statements.push(statement)
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
    const tableResult = await pool.query<{ table_name: string | null }>(
      "SELECT to_regclass('public.schema_migrations')::text AS table_name",
    )
    if (!tableResult.rows[0]?.table_name) {
      return {
        ok: true,
        currentVersion,
        appliedVersion: null,
        appliedAt: null,
        upToDate: false,
        statementCount,
      }
    }

    const { rows } = await pool.query<{
      migrate_sql_sha256: string
      applied_at: Date | string
    }>('SELECT migrate_sql_sha256, applied_at FROM public.schema_migrations WHERE id = 1')
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
  } catch (error) {
    return {
      ok: false,
      currentVersion,
      appliedVersion: null,
      appliedAt: null,
      upToDate: false,
      statementCount,
      error: errorMessage(error),
    }
  }
}

export async function applyMigrations(): Promise<MigrationApplyResult> {
  const version = migrationSqlHash()
  const statements = splitSqlStatements(MIGRATE_SQL)
  let client: PoolClient
  try {
    client = await pool.connect()
  } catch (error) {
    return {
      ok: false,
      applied: 0,
      total: statements.length,
      version,
      error: errorMessage(error),
    }
  }

  let applied = 0
  try {
    await client.query("SET statement_timeout = '120s'")
    for (const statement of statements) {
      await client.query(statement)
      applied += 1
    }
    await client.query(
      `INSERT INTO public.schema_migrations (id, migrate_sql_sha256, applied_at)
       VALUES (1, $1, now())
       ON CONFLICT (id) DO UPDATE
       SET migrate_sql_sha256 = EXCLUDED.migrate_sql_sha256, applied_at = now()`,
      [version],
    )
    return { ok: true, applied, total: statements.length, version }
  } catch (error) {
    return {
      ok: false,
      applied,
      total: statements.length,
      version,
      error: errorMessage(error),
    }
  } finally {
    try {
      await client.query('RESET statement_timeout')
    } catch {
      // A broken connection cannot be reset, but must still be released.
    }
    client.release()
  }
}
