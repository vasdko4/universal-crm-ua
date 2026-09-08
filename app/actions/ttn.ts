'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { deliveryMethods, orders, orderItems } from '@/lib/db/schema'
import { assertWritePermission } from '@/lib/session'
import { fillAuditTemplate } from '@/lib/audit-log'
import { getAdminDictionary } from '@/lib/i18n/admin/dictionaries'
import { buildInternetDocumentPayload } from '@/lib/delivery/ttn'
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
  const weight = opts.weightKg ?? Number(cfg.defaultWeight || 0.5) || 0.5
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
  const printUrl = `https://my.novaposhta.ua/orders/printDocument/orders[]/${encodeURIComponent(saved.ttn)}/type/pdf/apiKey/${encodeURIComponent(apiKey)}`
  return { ok: true, ttn: saved.ttn, printUrl }
}
