/**
 * Server-side GA4 `purchase` via the Measurement Protocol.
 *
 * The browser-side GA4 purchase (components/shop/google-ads.tsx) never fires
 * for visitors with ad blockers, so GA4 revenue silently under-reports. This
 * module resends the purchase server-side after a confirmed payment — the
 * "дубль" that keeps GA4 revenue complete.
 *
 * Rules (do not change):
 * - Best-effort: every failure is swallowed after a reportError() line.
 *   A broken GA4 integration must never break payment settlement.
 * - No credentials -> no-op (GA4_MEASUREMENT_ID / GA4_API_SECRET unset).
 * - No dedup against the client-side event: GA4 will count both the browser
 *   pixel and this server hit when both fire. If exact dedup is ever needed,
 *   pass the web client_id through and compare transaction_id in GA4.
 */

import { pool } from '@/lib/db'
import { fetchWithTimeout } from '@/lib/http'
import { reportError } from '@/lib/server-errors'

export type Ga4PurchaseItem = {
  itemId: string
  itemName: string
  quantity: number
  price: number
}

export type Ga4PurchaseEvent = {
  /** GA4 client_id. Server-side we have no _ga cookie, so a stable
   *  per-order id is used — deterministic across webhook retries. */
  clientId: string
  transactionId: string
  value: number
  currency: string
  items: Ga4PurchaseItem[]
}

export function buildGa4PurchasePayload(event: Ga4PurchaseEvent): Record<string, unknown> {
  return {
    client_id: event.clientId,
    events: [
      {
        name: 'purchase',
        params: {
          transaction_id: event.transactionId,
          value: Math.round(event.value * 100) / 100,
          currency: event.currency || 'UAH',
          items: event.items.map((i) => ({
            item_id: i.itemId,
            item_name: i.itemName,
            quantity: Math.max(1, Math.round(i.quantity)),
            price: Math.round(i.price * 100) / 100,
          })),
        },
      },
    ],
  }
}

type Ga4Creds = { measurementId: string; apiSecret: string } | null

export function readGa4Creds(env: NodeJS.ProcessEnv = process.env): Ga4Creds {
  const measurementId = (env.GA4_MEASUREMENT_ID ?? '').trim()
  const apiSecret = (env.GA4_API_SECRET ?? '').trim()
  if (!measurementId || !apiSecret) return null
  return { measurementId, apiSecret }
}

/**
 * Sends a server-side GA4 `purchase` for a paid order (matched by
 * orderNumber). Safe to call repeatedly — best-effort only, never throws.
 */
export async function reportGa4Purchase(orderReference: string): Promise<void> {
  const creds = readGa4Creds()
  if (!creds) return // GA4 not configured — no-op.
  try {
    const orderRes = await pool.query(
      `SELECT id, order_number, total, currency
         FROM orders
        WHERE order_number = $1
        LIMIT 1`,
      [orderReference],
    )
    const order = orderRes.rows[0]
    if (!order) return
    const itemsRes = await pool.query(
      `SELECT COALESCE(sku, 'id-' || product_id::text) AS sku,
              name,
              quantity,
              price
         FROM order_items
        WHERE order_id = $1
        ORDER BY id`,
      [order.id],
    )
    const value = Number(order.total)
    if (!Number.isFinite(value) || value <= 0) return
    const payload = buildGa4PurchasePayload({
      clientId: `order-${orderReference}`,
      transactionId: String(order.order_number),
      value,
      currency: String(order.currency ?? 'UAH'),
      items: itemsRes.rows.map((r) => ({
        itemId: String(r.sku ?? ''),
        itemName: String(r.name ?? '').slice(0, 200),
        quantity: Number(r.quantity) || 1,
        price: Number(r.price) || 0,
      })),
    })
    const url =
      `https://www.google-analytics.com/mp/collect` +
      `?measurement_id=${encodeURIComponent(creds.measurementId)}` +
      `&api_secret=${encodeURIComponent(creds.apiSecret)}`
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeoutMs: 10_000,
      label: 'ga4-mp',
    })
    if (!res.ok) {
      void reportError('ga4.purchase', new Error(`GA4 MP rejected the purchase event`), {
        context: { status: res.status, orderId: Number(order.id) },
      })
    }
  } catch (e) {
    // Best-effort: log only, never break the payment flow.
    void reportError('ga4.purchase', e)
  }
}
