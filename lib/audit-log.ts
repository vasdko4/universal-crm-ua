import 'server-only'

import { headers } from 'next/headers'
import { pool } from '@/lib/db'

export type AuditAction = 'login' | 'create' | 'update' | 'delete' | 'toggle' | 'settings' | 'security'

export type AuditEntry = {
  userId?: string | null
  userName?: string | null
  userEmail?: string | null
  action: AuditAction
  entity: string
  entityId?: string | number | null
  details?: string | null
}

/**
 * Fire-and-forget audit logging for the admin center. Never throws: a broken
 * log write must not take down the action that triggered it.
 */
export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    let ip: string | null = null
    try {
      const h = await headers()
      ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null
    } catch {
      // Not in a request scope (e.g. background job) — keep ip = null.
    }
    await pool.query(
      `INSERT INTO admin_logs (user_id, user_name, user_email, action, entity, entity_id, details, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        entry.userId ?? null,
        entry.userName ?? null,
        entry.userEmail ?? null,
        entry.action,
        entry.entity,
        entry.entityId != null ? String(entry.entityId) : null,
        entry.details ?? null,
        ip,
      ],
    )
  } catch (e) {
    console.log('[v0] audit log write failed:', (e as Error).message)
  }
}
