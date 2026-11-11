import { pool } from '@/lib/db'
import { trackDocuments } from '@/lib/delivery/nova-poshta'
import { enqueueNotification } from '@/lib/notifications'
import { getStoreSettingsInternal } from '@/lib/store-settings'
import { decryptSecret } from '@/lib/secrets'

export type DeliverySyncResult = {
  ok: boolean
  reason?: string
  checked: number
  updated: number
  /** Delivery-status emails queued in the notification outbox (the retry worker sends them). */
  emailed: number
  errors: string[]
}

/**
 * Synchronizes Nova Poshta delivery statuses for all in-flight orders with a
 * TTN. When the status text changes, the order row is updated and (if the
 * customer left an email and customer notifications are enabled) the email is
 * queued in the notification outbox for the retry worker — a failed send is
 * retried instead of lost, which matters because the status is already
 * committed and the next sync would skip the order. Delivered parcels also
 * move shipped orders to "done".
 */
export async function syncNovaPoshtaTracking(): Promise<DeliverySyncResult> {
  const result: DeliverySyncResult = { ok: true, checked: 0, updated: 0, emailed: 0, errors: [] }

  // 1) Nova Poshta API key from the delivery method config (stored in DB).
  const npRes = await pool.query(
    "SELECT config FROM delivery_methods WHERE code = 'nova_poshta' LIMIT 1",
  )
  // The API key is stored encrypted at rest (lib/secrets.ts); plaintext
  // (pre-migration) values pass through decryptSecret unchanged.
  const apiKey = decryptSecret(
    (npRes.rows[0]?.config as Record<string, string> | undefined)?.apiKey,
  ).trim()
  if (!apiKey) {
    return { ...result, ok: false, reason: 'Не задан API-ключ Нова Пошта в настройках доставки' }
  }

  const settings = await getStoreSettingsInternal().catch(() => null)
  // Both toggles: the master "Email-сповіщення" switch (Settings → Email)
  // stops all customer order emails, and "Лист покупцю" (Settings →
  // Сповіщення) gates customer emails on top of it.
  const notifyCustomers = Boolean(
    settings?.emailSettings?.enabled && settings?.notifications?.customerEmailEnabled,
  )

  // 2) In-flight orders, in pages of 100 by id cursor — the old LIMIT 300
  // silently skipped everything past the first 300 rows.
  const PAGE_SIZE = 100
  let cursorId: number | null = null
  for (;;) {
    const ordersRes = await pool.query(
      `SELECT * FROM orders
       WHERE delivery_method = 'nova_poshta'
         AND tracking_number IS NOT NULL AND tracking_number <> ''
         AND status NOT IN ('done', 'cancelled')
         AND ($1::int IS NULL OR id < $1)
       ORDER BY id DESC
       LIMIT $2`,
      [cursorId, PAGE_SIZE],
    )
    const rows = ordersRes.rows as Record<string, unknown>[]
    if (rows.length === 0) break
    result.checked += rows.length

    // 3) Batch-track this page's TTNs in one pass.
    const statuses = await trackDocuments(
      apiKey,
      rows.map((r) => String(r.tracking_number)),
    )
    const byTtn = new Map(statuses.map((s) => [s.ttn, s]))

    // 4) Apply changes order by order (statuses rarely change for many at once).
    for (const row of rows) {
      const ttn = String(row.tracking_number)
      const tracked = byTtn.get(ttn)
      if (!tracked) continue

      // NP codes 2/3 mean the TTN was deleted or not found — not a real status
      // change, so don't overwrite the order or notify the customer.
      if (tracked.statusCode === '2' || tracked.statusCode === '3') continue

      const oldStatus = String(row.delivery_status ?? '')
      if (tracked.status === oldStatus) continue

      try {
        // Delivered parcels complete the order lifecycle automatically.
        const newOrderStatus =
          tracked.delivered && String(row.status) === 'shipped' ? 'done' : String(row.status)

        const res = await pool.query(
          'UPDATE orders SET delivery_status = $1, status = $2, updated_at = now() WHERE id = $3 AND delivery_status IS NOT DISTINCT FROM $4',
          [tracked.status, newOrderStatus, row.id, row.delivery_status ?? null],
        )
        // Compare-and-swap: another sync run may have already applied this
        // status — only count and notify when this run actually changed it.
        if (res.rowCount === 0) continue
        result.updated++

        // Notify the customer by email when they left one — via the
        // notification outbox (lib/notifications.ts) so a failed send is
        // retried by the notification-retry worker instead of lost: the
        // status is already committed above, so the next sync would skip
        // this order and never get a second chance. Dedup is (kind,
        // channel, order_id) under the pending-only unique index — at most
        // one pending delivery-status notification per order, so a retry
        // never double-sends; the worker builds the message from the live
        // order row, so rapid successive status changes coalesce into a
        // single email carrying the latest status.
        const email = String(row.customer_email ?? '').trim()
        if (notifyCustomers && email) {
          const queued = await enqueueNotification('delivery-status', 'customer-email', Number(row.id))
          if (queued) {
            result.emailed++
          } else {
            result.errors.push(`Заказ №${row.order_number}: не удалось поставить письмо о статусе доставки в очередь`)
          }
        }
      } catch (e) {
        result.errors.push(`Заказ №${row.order_number}: ${(e as Error).message}`)
      }
    }

    cursorId = Number(rows[rows.length - 1].id)
    if (rows.length < PAGE_SIZE) break
  }

  return result
}
