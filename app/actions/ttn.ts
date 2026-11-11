'use server'

import { eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db, pool } from '@/lib/db'
import { deliveryMethods, orders, orderItems, products } from '@/lib/db/schema'
import { assertWritePermission } from '@/lib/session'
import { fillAuditTemplate } from '@/lib/audit-log'
import { getAdminDictionary } from '@/lib/i18n/admin/dictionaries'
import { buildInternetDocumentPayload, declaredCost, parcelWeightKg } from '@/lib/delivery/ttn'
import {
  fetchSenderProfile,
  findRecentDocumentsByPhone,
  matchRecentDocument,
  saveInternetDocument,
} from '@/lib/delivery/nova-poshta'
import type { NpRecentDocument } from '@/lib/delivery/nova-poshta'
import { reportError } from '@/lib/server-errors'
import { tryAdvisoryLock } from '@/lib/db/advisory-lock'
import { isUniqueViolation } from '@/lib/db/errors'
import { updateOrderDelivery } from '@/app/actions/orders'
import type { NpSenderRefs } from '@/lib/delivery/np-sender'
import { decryptSecret } from '@/lib/secrets'

// Advisory-lock namespace for TTN creation (distinct from the scheduler
// namespace in lib/prom/scheduler.ts and lib/cron/scheduler.ts).
const TTN_LOCK_NS = 20261112

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

  // Serialize concurrent creates per order with an advisory lock — NOT with
  // a DB transaction. Nova Poshta creates a real shipment per request, so two
  // simultaneous creates must not both reach the API; but the API call must
  // not run inside a transaction either (it used to hold the order row locked
  // for the whole network round-trip). Every attempt is journaled in
  // ttn_attempts: if a previous attempt's response was lost after NP created
  // the waybill, the retry reconciles with NP and binds it instead of
  // creating a second one.
  const lock = await tryAdvisoryLock(TTN_LOCK_NS, `order:${orderId}`).catch(() => null)
  if (!lock) return { ok: false, error: 'ТТН для цього замовлення вже створюється, зачекайте' }
  let saved: Awaited<ReturnType<typeof saveInternetDocument>>
  try {
    // Short tx 1: re-check under the row lock. No network call in here.
    const precheck = await (async (): Promise<{
      missing: boolean
      existingTtn: string | null
      ambiguous: boolean
    }> => {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const locked = await client.query<{ tracking_number: string | null }>(
          `SELECT tracking_number FROM orders WHERE id = $1 FOR UPDATE`,
          [orderId],
        )
        if (!locked.rows[0]) {
          await client.query('ROLLBACK')
          return { missing: true, existingTtn: null, ambiguous: false }
        }
        const existingTtn = (locked.rows[0].tracking_number || '').trim()
        if (existingTtn) {
          await client.query('COMMIT')
          return { missing: false, existingTtn, ambiguous: false }
        }
        const prev = await client.query(
          `SELECT id FROM ttn_attempts WHERE order_id = $1 AND status IN ('ambiguous', 'in_progress') AND created_at > NOW() - INTERVAL '48 hours' ORDER BY created_at DESC LIMIT 1`,
          [orderId],
        )
        await client.query('COMMIT')
        return { missing: false, existingTtn: null, ambiguous: (prev.rowCount ?? 0) > 0 }
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {})
        throw e
      } finally {
        client.release()
      }
    })()
    if (precheck.missing) return { ok: false, error: 'Замовлення не знайдено' }
    if (precheck.existingTtn) {
      return { ok: true, ttn: precheck.existingTtn, printUrl: `/api/admin/np-label?orderId=${orderId}` }
    }
    const hasAmbiguousAttempt = precheck.ambiguous

    // Reconcile (network, no transaction held): a previous attempt may have
    // created the waybill at NP while its response was lost. Bind it when
    // the phone and the declared value match; never bind a stranger's TTN.
    if (hasAmbiguousAttempt) {
      // The NP list lookup itself must not fail silently: if it throws, we
      // cannot know whether the waybill already exists, so abort instead of
      // creating a second one. The attempt stays 'ambiguous' and the next
      // retry reconciles again.
      let found: NpRecentDocument[]
      try {
        found = await findRecentDocumentsByPhone(apiKey, order.customerPhone || '')
      } catch (e) {
        void reportError('ttn.reconcile-lookup', e, { context: { orderId } })
        return {
          ok: false,
          error:
            'Не вдалося звірити накладні з Новою Поштою — нову ТТН не створено, спробуйте ще раз пізніше.',
        }
      }
      // NP stores the declared value rounded to whole hryvnias — compare
      // against declaredCost, the same value the payload builder sent, not
      // the raw order total (1500.50 is stored as 1501).
      const declared = declaredCost(Number(order.total) || 1)
      const match = matchRecentDocument(found, { declaredCost: declared, phone: order.customerPhone || '' })
      if (match) {
        // Bind inside one transaction while the order row is locked: the
        // "already bound to another order" check runs here, so a waybill
        // bound by a concurrent reconcile is seen and never double-bound.
        const client = await pool.connect()
        let reconciledTtn: string | null = null
        try {
          await client.query('BEGIN')
          const locked = await client.query<{ tracking_number: string | null }>(
            `SELECT tracking_number FROM orders WHERE id = $1 FOR UPDATE`,
            [orderId],
          )
          const existingTtn = (locked.rows[0]?.tracking_number || '').trim()
          if (existingTtn) {
            reconciledTtn = existingTtn
          } else {
            const bound = await client.query(
              `SELECT id FROM orders WHERE tracking_number = $1 AND id <> $2 LIMIT 1`,
              [match.ttn, orderId],
            )
            if ((bound.rowCount ?? 0) === 0) {
              await client.query(
                `UPDATE orders SET tracking_number = $2, updated_at = NOW() WHERE id = $1`,
                [orderId, match.ttn],
              )
              await client.query(
                `UPDATE ttn_attempts SET status = 'created', ttn = $2, updated_at = NOW() WHERE order_id = $1 AND status IN ('ambiguous', 'in_progress')`,
                [orderId, match.ttn],
              )
              reconciledTtn = match.ttn
            }
            // Bound to another order already: fall through and create a
            // fresh waybill below — this one is not ours to bind.
          }
          await client.query('COMMIT')
        } catch (e) {
          await client.query('ROLLBACK').catch(() => {})
          if (isUniqueViolation(e)) {
            // Lost the race: a concurrent reconcile bound this TTN to
            // another order between our check and the UPDATE. The unique
            // index is the final arbiter — do not rebind, do not crash.
            // Fall through to fresh-waybill creation below, exactly like
            // the check path above; the attempt stays ambiguous and the
            // next run reconciles it.
            void reportError('ttn.reconcile-bind-conflict', e, {
              context: { orderId, reason: `ttn ${match.ttn} already bound to another order` },
            })
          } else {
            throw e
          }
        } finally {
          client.release()
        }
        if (reconciledTtn) {
          return { ok: true, ttn: reconciledTtn, printUrl: `/api/admin/np-label?orderId=${orderId}` }
        }
      }
    }

    // Journal this attempt (best-effort: the flow must not break if the
    // table is missing on an install whose migration has not run yet).
    let attemptId: number | null = null
    try {
      const ins = await pool.query<{ id: number }>(
        `INSERT INTO ttn_attempts (order_id, status) VALUES ($1, 'in_progress') RETURNING id`,
        [orderId],
      )
      attemptId = ins.rows[0]?.id ?? null
    } catch {
      attemptId = null
    }

    // The API call itself — no transaction held.
    try {
      saved = await saveInternetDocument(apiKey, props)
    } catch (e) {
      if (attemptId != null) {
        await pool
          .query(`UPDATE ttn_attempts SET status = 'ambiguous', error = $2, updated_at = NOW() WHERE id = $1`, [
            attemptId,
            (e as Error).message,
          ])
          .catch(() => {})
      }
      return {
        ok: false,
        error:
          'Не вдалося підтвердити створення ТТН у Нової Пошти — можливо, накладну вже створено. Перевірте в кабінеті НП перед повтором.',
      }
    }
    if (!saved.ok || !saved.ttn) {
      if (attemptId != null) {
        await pool
          .query(`UPDATE ttn_attempts SET status = 'failed', error = $2, updated_at = NOW() WHERE id = $1`, [
            attemptId,
            saved.error || 'Не вдалося створити ТТН',
          ])
          .catch(() => {})
      }
      return { ok: false, error: saved.error || 'Не вдалося створити ТТН' }
    }

    // Short tx 2: save under the row lock; the advisory lock already
    // serialized concurrent creates, but re-check anyway.
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const locked = await client.query<{ tracking_number: string | null }>(
        `SELECT tracking_number FROM orders WHERE id = $1 FOR UPDATE`,
        [orderId],
      )
      const existingTtn = (locked.rows[0]?.tracking_number || '').trim()
      if (existingTtn) {
        if (attemptId != null) {
          await client.query(
            `UPDATE ttn_attempts SET status = 'failed', error = 'superseded', updated_at = NOW() WHERE id = $1`,
            [attemptId],
          )
        }
        await client.query('COMMIT')
        saved = { ok: true, ttn: existingTtn }
      } else {
        await client.query(
          `UPDATE orders SET tracking_number = $2, updated_at = NOW() WHERE id = $1`,
          [orderId, saved.ttn],
        )
        if (attemptId != null) {
          await client.query(
            `UPDATE ttn_attempts SET status = 'created', ttn = $2, updated_at = NOW() WHERE id = $1`,
            [attemptId, saved.ttn],
          )
        }
        await client.query('COMMIT')
      }
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {})
      if (isUniqueViolation(e)) {
        // The fresh TTN from NP was bound to another order between the
        // re-check and the UPDATE. The waybill exists at NP; the next
        // reconcile run finds it by phone + amount (or the admin retries).
        void reportError('ttn.create-bind-conflict', e, {
          context: { orderId, reason: `ttn ${saved.ttn} already bound to another order` },
        })
        return { ok: false, error: 'ТТН вже прив’язана до іншого замовлення — спробуйте ще раз' }
      }
      // BUGFIX: network failures / non-2xx used to throw as an unhandled 500
      // after the order was already read — the admin got no actionable error.
      return { ok: false, error: (e as Error).message || 'Помилка зʼєднання з Новою Поштою' }
    } finally {
      client.release()
    }
  } finally {
    await lock.release()
  }
  if (!saved.ttn) return { ok: false, error: 'Nova Poshta не повернула номер ТТН' }

  await updateOrderDelivery(orderId, {
    trackingNumber: saved.ttn,
    deliveryStatus: 'ТТН створено',
    deliveryMethod: 'nova_poshta',
  })

  // Creating a TTN and notifying the customer that the order shipped are
  // two separate actions: the TTN alone does not mean the parcel left the
  // warehouse. The "shipped" notification is sent when the admin moves the
  // order to the `shipped` status (updateOrderStatus).
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
