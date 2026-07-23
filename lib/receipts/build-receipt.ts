// Shared, plain (non 'use server') helper for building the printable order
// receipt shown in both the admin order page and the customer's account
// order page. No permission checks here — callers (already permission-gated
// server actions/pages) pass in the order/items they've already loaded.
import { db } from '@/lib/db'
import { payments, type Order, type OrderItem } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { generateReceiptQrDataUrl } from '@/lib/payments/receipt'
import { getStoreSettingsInternal } from '@/lib/store-settings'

export type OrderReceiptData = {
  storeName: string
  siteUrl: string
  order: Order
  items: OrderItem[]
  isFiscal: boolean
  receiptTargetUrl: string
  qrDataUrl: string
}

export async function buildOrderReceipt(order: Order, items: OrderItem[]): Promise<OrderReceiptData> {
  const [settings, [payment]] = await Promise.all([
    getStoreSettingsInternal(),
    db.select().from(payments).where(eq(payments.orderReference, order.orderNumber)).limit(1),
  ])

  const siteUrl = settings.seo.siteUrl?.trim() || ''
  const isFiscal = Boolean(payment?.receiptUrl)
  // Non-fiscal fallback: the QR just points at the store itself, never at
  // anything resembling an official fiscal check — we only link a real
  // fiscal URL when the gateway's own API actually returned one.
  const receiptTargetUrl = isFiscal ? payment!.receiptUrl! : siteUrl || '/'
  const qrDataUrl = await generateReceiptQrDataUrl(receiptTargetUrl)

  return {
    storeName: settings.storeName,
    siteUrl,
    order,
    items,
    isFiscal,
    receiptTargetUrl,
    qrDataUrl,
  }
}
