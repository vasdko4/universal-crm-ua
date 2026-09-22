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
import { getLocale } from '@/lib/i18n/server'
import { getSetupDictionary } from '@/lib/i18n/setup'
import {
  authorizeSetupToken,
  isBlockedPostgresHost,
  postgresHostFromUrl,
} from '@/lib/setup-token'

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
    console.error('[db-config] getDatabaseStatus failed:', (e as Error).message)
    return { configured, connected: false, schemaReady: false }
  }
}

export type SaveDatabaseInput =
  | { mode: 'fields'; host: string; port: string; database: string; user: string; password: string; ssl: boolean; setupToken?: string }
  | { mode: 'url'; url: string; setupToken?: string }

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
  const t = getSetupDictionary(await getLocale()).errors

  // SECURITY: this action rewrites DATABASE_URL on disk. A one-shot install
  // token (printed on first boot / SETUP_TOKEN) is required even on a fresh
  // install — otherwise anyone who can reach /setup becomes the first admin.
  if (!authorizeSetupToken(input.setupToken)) {
    return { ok: false, error: t.setupTokenRequired }
  }

  // Also refuse once the store is genuinely configured (schema + users).
  // If DATABASE_URL is already set, a downed pool must NOT reopen this
  // endpoint: that would let anyone overwrite the production connection
  // string during an outage.
  const alreadyConfigured = Boolean(getConnectionString())
  try {
    const guard = await pool.query(
      `SELECT to_regclass('public."user"') IS NOT NULL AS has_schema,
              COALESCE((SELECT COUNT(*) FROM "user"), 0)::int AS users`,
    )
    if (guard.rows[0]?.has_schema && guard.rows[0]?.users > 0) {
      return { ok: false, error: t.alreadyInstalled }
    }
  } catch {
    if (alreadyConfigured) {
      return { ok: false, error: t.alreadyInstalled }
    }
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
    return { ok: false, error: t.invalidPostgres }
  }
  if (input.mode === 'fields' && !input.database.trim()) {
    return { ok: false, error: t.dbNameRequired }
  }
  const host = input.mode === 'fields' ? input.host : postgresHostFromUrl(url)
  if (!host || isBlockedPostgresHost(host)) {
    return { ok: false, error: t.invalidPostgres }
  }

  const client = new Client({ connectionString: url, ssl: sslForConnectionString(url) })
  try {
    await client.connect()
    await client.query('SELECT 1')
  } catch (e) {
    await client.end().catch(() => {})
    console.error('[db-config] connect failed:', (e as Error).message)
    return { ok: false, error: t.connectFailed }
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
    console.error('[db-config] schema apply failed:', (e as Error).message)
    return { ok: false, error: t.schemaApplyFailed }
  } finally {
    await client.end().catch(() => {})
  }

  try {
    saveDatabaseUrl(url)
  } catch (e) {
    console.error('[db-config] env save failed:', (e as Error).message)
    return { ok: false, error: t.envSaveFailed }
  }

  return { ok: true, schemaApplied }
}
