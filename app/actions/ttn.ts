'use server'

import { eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db, pool } from '@/lib/db'
import { deliveryMethods, orders, orderItems, products } from '@/lib/db/schema'
import { assertWritePermission } from '@/lib/session'
import { fillAuditTemplate } from '@/lib/audit-log'
import { getAdminDictionary } from '@/lib/i18n/admin/dictionaries'
import { buildInternetDocumentPayload, parcelWeightKg } from '@/lib/delivery/ttn'
import { fetchSenderProfile, saveInternetDocument } from '@/lib/delivery/nova-poshta'
import { updateOrderDelivery } from '@/app/actions/orders'
import type { NpSenderRefs } from '@/lib/delivery/np-sender'
import { decryptSecret } from '@/lib/secrets'

type NpConfig = {
  apiKey?: string
  senderCityRef?: string
  senderRef?: string
  senderAddressRef?: string
  contactSenderRef?: string
  senderPhone?: string
  defaultWeight?: string
}

async function npConfig(): Promise<NpConfig> {
  const [row] = await db
    .select()
    .from(deliveryMethods)
    .where(eq(deliveryMethods.code, 'nova_poshta'))
    .limit(1)
  return ((row?.config as NpConfig) ?? {}) as NpConfig
}

async function persistSenderRefs(cfg: NpConfig, sender: NpSenderRefs) {
  await db
    .update(deliveryMethods)
    .set({
      config: {
        ...cfg,
        senderCityRef: sender.senderCityRef,
        senderRef: sender.senderRef,
        senderAddressRef: sender.senderAddressRef,
        contactSenderRef: sender.contactSenderRef,
        senderPhone: sender.senderPhone || cfg.senderPhone || '',
      },
      updatedAt: new Date(),
    })
    .where(eq(deliveryMethods.code, 'nova_poshta'))
}

export async function createTtnForOrder(
  orderId: number,
  opts: { weightKg?: number; seats?: number; description?: string } = {},
): Promise<{ ok: boolean; ttn?: string; printUrl?: string; error?: string }> {
  const user = await assertWritePermission('orders')
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  if (!order) return { ok: false, error: 'Замовлення не знайдено' }
  if (order.deliveryMethod && order.deliveryMethod !== 'nova_poshta') {
    return { ok: false, error: 'ТТН доступна лише для Нової Пошти' }
  }
  if (order.trackingNumber) return { ok: false, error: 'ТТН уже створена' }

  const cfg = await npConfig()
  const apiKey = (decryptSecret(cfg.apiKey) || process.env.NOVA_POSHTA_API_KEY || '').trim()
  if (!apiKey) return { ok: false, error: 'Не задано API-ключ Нової Пошти' }

  let sender: NpSenderRefs = {
    senderCityRef: cfg.senderCityRef || '',
    senderRef: cfg.senderRef || '',
    senderAddressRef: cfg.senderAddressRef || '',
    contactSenderRef: cfg.contactSenderRef || '',
    senderPhone: cfg.senderPhone || '',
  }
  if (!sender.senderCityRef || !sender.senderRef || !sender.senderAddressRef || !sender.contactSenderRef) {
    // BUGFIX: network failures / non-2xx used to throw straight through as an
    // unhandled 500. Convert to a normal {ok:false} result.
    let fetched: Awaited<ReturnType<typeof fetchSenderProfile>>
    try {
      fetched = await fetchSenderProfile(apiKey)
    } catch (e) {
      return { ok: false, error: (e as Error).message || 'Помилка зʼєднання з Новою Поштою' }
    }
    if (!fetched.ok) {
      return {
        ok: false,
        error:
          fetched.error ||
          'Заповніть реквізити відправника в Доставка → Нова Пошта (або натисніть «Підтягнути з кабінету»)',
      }
    }
    sender = fetched.refs
    await persistSenderRefs(cfg, sender)
  }

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId))
  const description =
    opts.description?.trim() ||
    items
      .map((i) => i.name)
      .filter(Boolean)
      .slice(0, 3)
      .join(', ') ||
    `Замовлення ${order.orderNumber}`
  const productIds = [...new Set(items.map((i) => i.productId).filter((id): id is number => typeof id === 'number'))]
  const productRows =
    productIds.length > 0
      ? await db.select({ id: products.id, weight: products.weight }).from(products).where(inArray(products.id, productIds))
      : []
  const weightByProduct = new Map(productRows.map((p) => [p.id, p.weight]))
  const weight =
    opts.weightKg ??
    parcelWeightKg(
      items.map((i) => ({
        weightKg: i.productId != null ? weightByProduct.get(i.productId) : null,
        quantity: i.quantity,
      })),
      Number(cfg.defaultWeight || 0.5) || 0.5,
    )
  const seats = opts.seats ?? 1

  const props = buildInternetDocumentPayload({
    sender: {
      cityRef: sender.senderCityRef,
      senderRef: sender.senderRef,
      senderAddressRef: sender.senderAddressRef,
      contactSenderRef: sender.contactSenderRef,
      phone: sender.senderPhone,
    },
    recipient: {
      name: order.customerName || 'Отримувач',
      phone: order.customerPhone || '',
      cityName: order.deliveryCity || '',
      cityRef: order.deliveryCityRef || undefined,
      warehouseRef: order.deliveryWarehouseRef || undefined,
      warehouseName: order.deliveryBranch || undefined,
      address: order.deliveryAddress || undefined,
    },
    cargo: {
      description,
      cost: Number(order.total) || 1,
      weightKg: weight,
      seats,
    },
  })

  // BUGFIX: idempotency. The trackingNumber guard at the top of this function
  // doesn't protect against two parallel clicks — and every
  // saveInternetDocument() creates a REAL consignment in Nova Poshta's
  // system. Re-check right before the NP call: a duplicate invocation reuses
  // the existing TTN instead of creating a second (orphaned) one.
  const [fresh] = await db
    .select({ trackingNumber: orders.trackingNumber })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)
  const existingTtn = (fresh?.trackingNumber || '').trim()
  if (existingTtn) {
    return { ok: true, ttn: existingTtn, printUrl: `/api/admin/np-label?orderId=${orderId}` }
  }

  let saved: Awaited<ReturnType<typeof saveInternetDocument>>
  try {
    saved = await saveInternetDocument(apiKey, props)
  } catch (e) {
    // BUGFIX: network failures / non-2xx used to throw as an unhandled 500
    // after the order was already read — the admin got no actionable error.
    return { ok: false, error: (e as Error).message || 'Помилка зʼєднання з Новою Поштою' }
  }
  if (!saved.ok || !saved.ttn) return { ok: false, error: saved.error || 'Не вдалося створити ТТН' }

  // Claim the write atomically: only the first concurrent caller wins. The
  // loser re-reads and returns the winner's TTN instead of overwriting it
  // with its own orphan consignment.
  const claim = await pool.query(
    `UPDATE orders
        SET tracking_number = $2, updated_at = NOW()
      WHERE id = $1 AND (tracking_number IS NULL OR tracking_number = '')
      RETURNING id`,
    [orderId, saved.ttn],
  )
  if (!claim.rowCount) {
    const [winner] = await db
      .select({ trackingNumber: orders.trackingNumber })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)
    const winnerTtn = (winner?.trackingNumber || '').trim() || saved.ttn
    return { ok: true, ttn: winnerTtn, printUrl: `/api/admin/np-label?orderId=${orderId}` }
  }

  await updateOrderDelivery(orderId, {
    trackingNumber: saved.ttn,
    deliveryStatus: 'ТТН створено',
    deliveryMethod: 'nova_poshta',
  })

  const t = getAdminDictionary(user.locale).auditLog
  void t
  void fillAuditTemplate
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath('/admin/orders')
  return { ok: true, ttn: saved.ttn, printUrl: `/api/admin/np-label?orderId=${orderId}` }
}

export async function printTtnForOrder(
  orderId: number,
): Promise<{ ok: boolean; printUrl?: string; error?: string }> {
  await assertWritePermission('orders')
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  if (!order) return { ok: false, error: 'Замовлення не знайдено' }
  const ttn = (order.trackingNumber || '').trim()
  if (!ttn) return { ok: false, error: 'Немає ТТН для друку' }
  const cfg = await npConfig()
  const apiKey = (decryptSecret(cfg.apiKey) || process.env.NOVA_POSHTA_API_KEY || '').trim()
  if (!apiKey) return { ok: false, error: 'Не задано API-ключ Нової Пошти' }
  return { ok: true, printUrl: `/api/admin/np-label?orderId=${orderId}` }
}
