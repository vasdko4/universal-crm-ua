'use server'

import { eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { deliveryMethods, orders, orderItems, products } from '@/lib/db/schema'
import { assertWritePermission } from '@/lib/session'
import { fillAuditTemplate } from '@/lib/audit-log'
import { getAdminDictionary } from '@/lib/i18n/admin/dictionaries'
import { buildInternetDocumentPayload, parcelWeightKg } from '@/lib/delivery/ttn'
import { fetchSenderProfile, saveInternetDocument } from '@/lib/delivery/nova-poshta'
import { updateOrderDelivery } from '@/app/actions/orders'
import type { NpSenderRefs } from '@/lib/delivery/np-sender'

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
  const apiKey = (cfg.apiKey || process.env.NOVA_POSHTA_API_KEY || '').trim()
  if (!apiKey) return { ok: false, error: 'Не задано API-ключ Нової Пошти' }

  let sender: NpSenderRefs = {
    senderCityRef: cfg.senderCityRef || '',
    senderRef: cfg.senderRef || '',
    senderAddressRef: cfg.senderAddressRef || '',
    contactSenderRef: cfg.contactSenderRef || '',
    senderPhone: cfg.senderPhone || '',
  }
  if (!sender.senderCityRef || !sender.senderRef || !sender.senderAddressRef || !sender.contactSenderRef) {
    const fetched = await fetchSenderProfile(apiKey)
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

  const saved = await saveInternetDocument(apiKey, props)
  if (!saved.ok || !saved.ttn) return { ok: false, error: saved.error || 'Не вдалося створити ТТН' }

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
  const apiKey = (cfg.apiKey || process.env.NOVA_POSHTA_API_KEY || '').trim()
  if (!apiKey) return { ok: false, error: 'Не задано API-ключ Нової Пошти' }
  return { ok: true, printUrl: `/api/admin/np-label?orderId=${orderId}` }
}
