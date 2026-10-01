'use server'

import { revalidatePath } from 'next/cache'
import { assertPermission, assertWritePermission } from '@/lib/session'
import {
  getMigrationStatus,
  applyMigrations,
  type MigrationStatus,
  type MigrationApplyResult,
} from '@/lib/db/migrate-runner'

export type { MigrationStatus, MigrationApplyResult }

export async function getDbMigrationStatus(): Promise<MigrationStatus> {
  await assertPermission('system_updates')
  return getMigrationStatus()
}

export async function applyDbMigrations(): Promise<MigrationApplyResult> {
  await assertWritePermission('system_updates')
  const result = await applyMigrations()
  if (result.ok) revalidatePath('/admin/updates')
  return result
}
