'use server'

import { assertWritePermission } from '@/lib/session'
import { syncPromProducts } from '@/lib/prom/sync'

/**
 * Manual "Sync now" from Настройки → Prom. Runs the same Prom → engine
 * sync as the hourly cron; the result summary is mirrored into
 * settings.prom.lastSync* by the sync itself.
 */
export async function triggerPromSync(): Promise<{ ok: boolean; summary?: string; error?: string }> {
  try {
    await assertWritePermission('products')
    const res = await syncPromProducts()
    if (!res.ok) return { ok: false, error: res.reason ?? 'Помилка синхронізації' }
    return { ok: true, summary: res.summary }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
