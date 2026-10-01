'use server'

import { revalidatePath } from 'next/cache'
import { assertWritePermission } from '@/lib/session'
import {
  getMigrationStatus,
  applyMigrations,
  type MigrationStatus,
  type MigrationApplyResult,
} from '@/lib/db/migrate-runner'

// Re-exported for client components.
export type { MigrationStatus, MigrationApplyResult }

/**
 * DB schema version check for /admin/updates ("Перевірити версію БД").
 * Compares the SHA-256 of the bundled db/migrate.sql with the hash recorded
 * in the schema_migrations table. Read-only.
 */
export async function getDbMigrationStatus(): Promise<MigrationStatus> {
  await assertWritePermission('system_updates')
  return getMigrationStatus()
}

/**
 * Applies the bundled db/migrate.sql to the database. All statements are
 * idempotent (IF NOT EXISTS), so this is safe to run even when the schema
 * is already up to date, and a failed run can be retried.
 */
export async function applyDbMigrations(): Promise<MigrationApplyResult> {
  await assertWritePermission('system_updates')
  const result = await applyMigrations()
  if (result.ok) {
    revalidatePath('/admin/updates')
  }
  return result
}
