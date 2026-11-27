'use server'

import { assertWritePermission } from '@/lib/session'
import { syncPromProducts } from '@/lib/prom/sync'
import { isRateLimited } from '@/lib/api/rate-limit'

/**
 * Manual "Sync now" from Настройки → Prom. Runs the same Prom → engine
 * sync as the hourly cron; the result summary is mirrored into
 * settings.prom.lastSync* by the sync itself.
 */
export async function triggerPromSync(): Promise<{ ok: boolean; summary?: string; error?: string }> {
  try {
    const user = await assertWritePermission('products')
    // Audit #16: a manual sync is a slow, API-keyed Prom.ua crawl — cap it
    // per admin (the sync itself single-flights, but the button must not
    // be hammerable into repeated full crawls).
    if (await isRateLimited('prom-sync-manual', user.id, 10, 60_000)) {
      return { ok: false, error: 'Забагато спроб. Спробуйте через хвилину.' }
    }
    const res = await syncPromProducts()
    if (!res.ok) return { ok: false, error: res.reason ?? 'Помилка синхронізації' }
    return { ok: true, summary: res.summary }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
