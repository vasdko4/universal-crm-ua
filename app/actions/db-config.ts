'use server'

import { Client } from 'pg'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pool } from '@/lib/db'
import {
  buildConnectionString,
  getConnectionString,
  saveDatabaseUrl,
  sslForConnectionString,
} from '@/lib/db/config'

export type DatabaseStatus = {
  configured: boolean
  connected: boolean
  schemaReady: boolean
  error?: string
}

/**
 * Reports the health of the connection the running app actually uses (the
 * shared pool). Because the pool is created at boot, this only turns
 * "connected" once the dev server has been (re)started with a valid
 * DATABASE_URL — exactly what we want to gate the wizard on.
 */
export async function getDatabaseStatus(): Promise<DatabaseStatus> {
  const configured = Boolean(getConnectionString())
  try {
    const res = await pool.query(`SELECT to_regclass('public."user"') IS NOT NULL AS ready`)
    return { configured, connected: true, schemaReady: Boolean(res.rows[0]?.ready) }
  } catch (e) {
    return { configured, connected: false, schemaReady: false, error: (e as Error).message }
  }
}

export type SaveDatabaseInput =
  | { mode: 'fields'; host: string; port: string; database: string; user: string; password: string; ssl: boolean }
  | { mode: 'url'; url: string }

export type SaveDatabaseResult = {
  ok: boolean
  schemaApplied?: boolean
  error?: string
}

/**
 * Validate the provided credentials with a throwaway connection, apply the
 * schema if the database is empty, then persist DATABASE_URL to .env.local.
 * A dev-server restart is required afterwards so Better Auth and the shared
 * pool bind to the new connection.
 */
export async function saveDatabaseConfig(input: SaveDatabaseInput): Promise<SaveDatabaseResult> {
  // SECURITY: this action rewrites DATABASE_URL on disk. Allow it only while
  // the app is genuinely unconfigured (no working DB / empty schema / no
  // users). Once the store is installed, changing the DB requires editing
  // .env.local on the server — never a public endpoint.
  try {
    const guard = await pool.query(
      `SELECT to_regclass('public."user"') IS NOT NULL AS has_schema,
              COALESCE((SELECT COUNT(*) FROM "user"), 0)::int AS users`,
    )
    if (guard.rows[0]?.has_schema && guard.rows[0]?.users > 0) {
      return { ok: false, error: 'Установка уже выполнена. Подключение к БД меняется через .env.local на сервере.' }
    }
  } catch {
    // Current pool is broken/unconfigured — that's exactly the state where
    // the setup screen must be able to save a new connection.
  }

  const url =
    input.mode === 'url'
      ? input.url.trim()
      : buildConnectionString({
          host: input.host,
          port: input.port,
          database: input.database,
          user: input.user,
          password: input.password,
          ssl: input.ssl,
        })

  if (!url || !/^postgres(ql)?:\/\//.test(url)) {
    return { ok: false, error: 'Укажите корректные данные подключения к PostgreSQL' }
  }
  if (input.mode === 'fields' && !input.database.trim()) {
    return { ok: false, error: 'Укажите имя базы данных' }
  }

  const client = new Client({ connectionString: url, ssl: sslForConnectionString(url) })
  try {
    await client.connect()
    await client.query('SELECT 1')
  } catch (e) {
    await client.end().catch(() => {})
    return { ok: false, error: `Не удалось подключиться: ${(e as Error).message}` }
  }

  let schemaApplied = false
  try {
    const ready = await client.query(`SELECT to_regclass('public."user"') IS NOT NULL AS r`)
    if (!ready.rows[0]?.r) {
      const sql = readFileSync(join(process.cwd(), 'db', 'schema.sql'), 'utf8')
      if (sql.trim()) {
        await client.query(sql)
        schemaApplied = true
      }
    }
  } catch (e) {
    return { ok: false, error: `Подключение успешно, но не удалось применить схему: ${(e as Error).message}` }
  } finally {
    await client.end().catch(() => {})
  }

  try {
    saveDatabaseUrl(url)
  } catch (e) {
    return { ok: false, error: `Не удалось сохранить .env.local: ${(e as Error).message}` }
  }

  return { ok: true, schemaApplied }
}
