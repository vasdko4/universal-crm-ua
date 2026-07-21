import { pool } from '@/lib/db'
import type { Order, OrderItem } from '@/lib/db/schema'
import { trackDocuments } from '@/lib/delivery/nova-poshta'
import { sendMail } from '@/lib/mailer'
import { buildOrderMessage } from '@/lib/order-messages'
import { getStoreSettingsInternal } from '@/lib/store-settings'

export type DeliverySyncResult = {
  ok: boolean
  reason?: string
  checked: number
  updated: number
  emailed: number
  errors: string[]
}

/** pg snake_case row -> camelCase shape expected by the email templates. */
function normalizeOrder(r: Record<string, unknown>): Order {
  return {
    ...r,
    orderNumber: r.order_number,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    customerEmail: r.customer_email,
    deliveryMethod: r.delivery_method,
    deliveryCity: r.delivery_city,
    deliveryBranch: r.delivery_branch,
    deliveryAddress: r.delivery_address,
    deliveryCost: r.delivery_cost,
    deliveryStatus: r.delivery_status,
    trackingNumber: r.tracking_number,
    paymentMethod: r.payment_method,
    paymentStatus: r.payment_status,
    itemsTotal: r.items_total,
  } as Order
}

function normalizeItem(r: Record<string, unknown>): OrderItem {
  return { ...r, variantLabel: r.variant_label, productId: r.product_id } as OrderItem
}

/**
 * Synchronizes Nova Poshta delivery statuses for all in-flight orders with a
 * TTN. When the status text changes, the order row is updated and (if the
 * customer left an email and customer notifications are enabled) an email is
 * sent. Delivered parcels also move shipped orders to "done".
 */
export async function syncNovaPoshtaTracking(): Promise<DeliverySyncResult> {
  const result: DeliverySyncResult = { ok: true, checked: 0, updated: 0, emailed: 0, errors: [] }

  // 1) Nova Poshta API key from the delivery method config (stored in DB).
  const npRes = await pool.query(
    "SELECT config FROM delivery_methods WHERE code = 'nova_poshta' LIMIT 1",
  )
  const apiKey = String(
    (npRes.rows[0]?.config as Record<string, string> | undefined)?.apiKey ?? '',
  ).trim()
  if (!apiKey) {
    return { ...result, ok: false, reason: 'Не задан API-ключ Нова Пошта в настройках доставки' }
  }

  // 2) In-flight orders that have a TTN and are not finished/cancelled.
  const ordersRes = await pool.query(
    `SELECT * FROM orders
     WHERE delivery_method = 'nova_poshta'
       AND tracking_number IS NOT NULL AND tracking_number <> ''
       AND status NOT IN ('done', 'cancelled')
     ORDER BY updated_at DESC
     LIMIT 300`,
  )
  const rows = ordersRes.rows as Record<string, unknown>[]
  result.checked = rows.length
  if (rows.length === 0) return result

  // 3) Batch-track all TTNs in one pass.
  const statuses = await trackDocuments(
    apiKey,
    rows.map((r) => String(r.tracking_number)),
  )
  const byTtn = new Map(statuses.map((s) => [s.ttn, s]))

  const settings = await getStoreSettingsInternal().catch(() => null)
  const notifyCustomers = Boolean(settings?.notifications?.customerEmailEnabled)

  const envUrl = process.env.NEXT_PUBLIC_SITE_URL
    ? String(process.env.NEXT_PUBLIC_SITE_URL)
    : process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : ''
  const siteUrl = (settings?.seo?.siteUrl || envUrl).replace(/\/$/, '')
  const storeCtx = {
    storeName: settings?.storeName,
    siteUrl,
    logoUrl: settings?.logoUrl,
    phone: settings?.contact?.phones?.find(Boolean) ?? null,
    supportEmail: (settings?.emailSettings?.fromEmail as string) || null,
  }

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

      await pool.query(
        'UPDATE orders SET delivery_status = $1, status = $2, updated_at = now() WHERE id = $3',
        [tracked.status, newOrderStatus, row.id],
      )
      result.updated++

      // Notify the customer by email when they left one.
      const email = String(row.customer_email ?? '').trim()
      if (notifyCustomers && email) {
        const itemsRes = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [
          row.id,
        ])
        const order = normalizeOrder({
          ...row,
          delivery_status: tracked.status,
          status: newOrderStatus,
        })
        const items = itemsRes.rows.map(normalizeItem)
        const msg = buildOrderMessage('status', order, items, storeCtx)
        await sendMail({ to: email, subject: msg.subject, text: msg.text, html: msg.html })
        result.emailed++
      }
    } catch (e) {
      result.errors.push(`Заказ №${row.order_number}: ${(e as Error).message}`)
    }
  }

  return result
}
