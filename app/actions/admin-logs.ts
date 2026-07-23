'use server'

import { pool } from '@/lib/db'
import { requirePermission } from '@/lib/session'
import type { AdminLog } from '@/lib/db/schema'

export type LogsFilter = {
  entity?: string
  action?: string
  search?: string
  page?: number
}

export type LogsResult = {
  items: AdminLog[]
  total: number
  page: number
  pageSize: number
  entities: string[]
}

const PAGE_SIZE = 50

// Read the audit log (admin "Логи" tab). Guarded by the logs permission.
export async function getAdminLogs(filter: LogsFilter = {}): Promise<LogsResult> {
  await requirePermission('logs')

  const page = Math.max(1, filter.page ?? 1)
  const where: string[] = []
  const params: unknown[] = []

  if (filter.entity) {
    params.push(filter.entity)
    where.push(`entity = $${params.length}`)
  }
  if (filter.action) {
    params.push(filter.action)
    where.push(`action = $${params.length}`)
  }
  if (filter.search?.trim()) {
    params.push(`%${filter.search.trim()}%`)
    where.push(
      `(user_name ILIKE $${params.length} OR user_email ILIKE $${params.length} OR details ILIKE $${params.length} OR entity_id ILIKE $${params.length})`,
    )
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const countRes = await pool.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM admin_logs ${whereSql}`,
    params,
  )
  const total = countRes.rows[0]?.c ?? 0

  params.push(PAGE_SIZE, (page - 1) * PAGE_SIZE)
  const rows = await pool.query(
    `SELECT id, user_id AS "userId", user_name AS "userName", user_email AS "userEmail",
            action, entity, entity_id AS "entityId", details, ip, created_at AS "createdAt"
     FROM admin_logs ${whereSql}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  )

  const entitiesRes = await pool.query<{ entity: string }>(
    `SELECT DISTINCT entity FROM admin_logs ORDER BY entity`,
  )

  return {
    items: rows.rows as AdminLog[],
    total,
    page,
    pageSize: PAGE_SIZE,
    entities: entitiesRes.rows.map((r) => r.entity),
  }
}

// Clear logs older than N days (or all when days = 0). Audit-worthy itself.
export async function clearAdminLogs(days: number): Promise<{ ok: boolean; removed: number }> {
  const user = await requirePermission('logs')

  const res =
    days > 0
      ? await pool.query(`DELETE FROM admin_logs WHERE created_at < NOW() - ($1 || ' days')::interval`, [days])
      : await pool.query(`DELETE FROM admin_logs`)

  const { auditLog, fillAuditTemplate } = await import('@/lib/audit-log')
  const { getAdminDictionary } = await import('@/lib/i18n/admin/dictionaries')
  const t = getAdminDictionary(user.locale).auditLog
  await auditLog({
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    action: 'security',
    entity: 'logs',
    details:
      days > 0
        ? fillAuditTemplate(t.logsClearedOld, { days, count: res.rowCount ?? 0 })
        : fillAuditTemplate(t.logsClearedAll, { count: res.rowCount ?? 0 }),
  })

  return { ok: true, removed: res.rowCount ?? 0 }
}
