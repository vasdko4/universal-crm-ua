import { pool } from '@/lib/db'
import { trackDocuments } from '@/lib/delivery/nova-poshta'
import { getStoreSettingsInternal } from '@/lib/store-settings'
import { decryptSecret } from '@/lib/secrets'
import { reportError } from '@/lib/server-errors'

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
 * retried instead of lost. The status UPDATE and the outbox INSERT run in
 * one transaction, so a failed enqueue rolls the status back and the next
 * sync re-processes the change. Delivered parcels also move shipped orders
 * to "done".
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

    // 3) Batch-track this page's TTNs in one pass. A failed batch (NP
    // timeout / 500) must not abort the whole daily run — the pages
    // already collected stay, the failure is recorded in errors, and the
    // loop continues with the next page (same guarding style as the
    // per-order loop below: statuses stay fresh instead of going stale
    // for a day because of one bad batch).
    let statuses: Awaited<ReturnType<typeof trackDocuments>> = []
    try {
      statuses = await trackDocuments(
        apiKey,
        rows.map((r) => String(r.tracking_number)),
      )
    } catch (e) {
      result.errors.push(`Сторінка накладних (${rows.length} шт.): ${(e as Error).message}`)
      // byTtn stays empty, so the per-order loop below skips every row of
      // this page and the cursor still advances to the next one.
    }
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

        // A11 + A13: the status UPDATE and the outbox INSERT run in ONE
        // transaction on a single pool client. A failed enqueue rolls the
        // status update back, so the next sync re-processes the change
        // instead of skipping it forever (the old code committed the
        // status first and enqueued afterwards, so an enqueue failure
        // lost the email permanently). The CAS also covers every field
        // the write derives from the stale page read — delivery_status,
        // status AND tracking_number — so an operator edit mid-sync
        // (e.g. cancelling the order, or re-issuing the TTN) blocks the
        // write instead of being clobbered with stale values.
        const client = await pool.connect()
        let willEmail = false
        try {
          await client.query('BEGIN')
          const res = await client.query(
            `UPDATE orders SET delivery_status = $1, status = $2, updated_at = now()
              WHERE id = $3
                AND delivery_status IS NOT DISTINCT FROM $4
                AND status = $5
                AND tracking_number IS NOT DISTINCT FROM $6`,
            [
              tracked.status,
              newOrderStatus,
              row.id,
              row.delivery_status ?? null,
              row.status,
              row.tracking_number ?? null,
            ],
          )
          // Compare-and-swap: another sync run (or an operator edit) may
          // have already changed the row — only count and notify when
          // this run actually changed it. The next scheduled run
          // re-reads the row fresh and re-evaluates, so skipping is safe.
          if (res.rowCount === 0) {
            await client.query('ROLLBACK')
            continue
          }

          // Notify the customer by email when they left one — via the
          // notification outbox (lib/notifications.ts) so a failed send
          // is retried by the notification-retry worker instead of lost.
          // The INSERT is inline here (same row shape as
          // enqueueNotification, same pending-only dedup) because the
          // outbox write must share the status transaction — at most one
          // pending delivery-status notification per order, so a retry
          // never double-sends; the worker builds the message from the
          // live order row, so rapid successive status changes coalesce
          // into a single email carrying the latest status.
          const email = String(row.customer_email ?? '').trim()
          willEmail = notifyCustomers && email !== ''
          if (willEmail) {
            await client.query(
              `INSERT INTO notification_outbox (kind, channel, order_id, status)
               VALUES ('delivery-status', 'customer-email', $1, 'pending')
               ON CONFLICT (kind, channel, order_id) WHERE status = 'pending' DO NOTHING`,
              [Number(row.id)],
            )
          }
          await client.query('COMMIT')
        } catch (e) {
          try {
            await client.query('ROLLBACK')
          } catch {
            /* connection already closed */
          }
          throw e
        } finally {
          client.release()
        }
        // Count only after COMMIT: a rolled-back change is not an update.
        result.updated++
        if (willEmail) result.emailed++
      } catch (e) {
        result.errors.push(`Заказ №${row.order_number}: ${(e as Error).message}`)
      }
    }

    cursorId = Number(rows[rows.length - 1].id)
    if (rows.length < PAGE_SIZE) break
  }

  // A12: a partial run must not look like a success. Errors were recorded
  // all along but never flipped ok, so the route returned 200 and the cron
  // record said 'ok' for a degraded run. The route derives its 422 +
  // 'error' record from result.ok, and the admin is paged the way a total
  // failure already is.
  if (result.errors.length > 0) {
    result.ok = false
    void reportError(
      'cron.delivery-sync-partial',
      new Error(
        `Delivery sync finished with ${result.errors.length} error(s): ${result.errors.slice(0, 3).join(' | ')}`,
      ),
      { alertAdmin: true },
    )
  }

  return result
}
