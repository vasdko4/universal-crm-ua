'use server'

import { assertPermission, assertWritePermission } from '@/lib/session'
import { pool } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export type ErrorLogRow = {
  id: number
  createdAt: string
  tag: string
  message: string
  context: Record<string, unknown> | null
  occurrences: number
  firstSeen: string
  lastSeen: string
  resolved: boolean
}

export async function getErrorLogs(opts?: {
  resolved?: boolean
  tag?: string
  limit?: number
}): Promise<ErrorLogRow[]> {
  await assertPermission('logs')
  const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 500)
  const conds: string[] = []
  const params: unknown[] = []
  if (opts?.resolved !== undefined) {
    params.push(opts.resolved)
    conds.push(`resolved = $${params.length}`)
  }
  if (opts?.tag) {
    params.push(opts.tag)
    conds.push(`tag = $${params.length}`)
  }
  params.push(limit)
  const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : ''
  const { rows } = await pool.query(
    `SELECT id, created_at, tag, message, context, occurrences, first_seen, last_seen, resolved
       FROM error_logs ${where}
      ORDER BY last_seen DESC
      LIMIT $${params.length}`,
    params,
  )
  return rows.map((r) => ({
    id: Number(r.id),
    createdAt: new Date(r.created_at).toISOString(),
    tag: String(r.tag),
    message: String(r.message),
    context: (r.context as Record<string, unknown> | null) ?? null,
    occurrences: Number(r.occurrences),
    firstSeen: new Date(r.first_seen).toISOString(),
    lastSeen: new Date(r.last_seen).toISOString(),
    resolved: Boolean(r.resolved),
  }))
}

export async function getErrorLogTags(): Promise<string[]> {
  await assertPermission('logs')
  const { rows } = await pool.query(
    `SELECT DISTINCT tag FROM error_logs ORDER BY tag LIMIT 100`,
  )
  return rows.map((r) => String(r.tag))
}

export async function setErrorLogResolved(
  id: number,
  resolved: boolean,
): Promise<{ ok: boolean }> {
  await assertWritePermission('logs')
  await pool.query(`UPDATE error_logs SET resolved = $2 WHERE id = $1`, [id, resolved])
  revalidatePath('/admin/error-logs')
  return { ok: true }
}

export async function clearResolvedErrorLogs(): Promise<{ ok: boolean; deleted: number }> {
  await assertWritePermission('logs')
  const { rowCount } = await pool.query(`DELETE FROM error_logs WHERE resolved = true`)
  revalidatePath('/admin/error-logs')
  return { ok: true, deleted: rowCount ?? 0 }
}
