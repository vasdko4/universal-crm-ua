'use server'

import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db, pool } from '@/lib/db'
import {
  orders,
  orderItems,
  orderHistory,
  products,
  customers,
} from '@/lib/db/schema'
import { getAdminUser, assertPermission } from '@/lib/session'
import { ORDER_STATUSES, PAYMENT_STATUSES } from '@/lib/order-status'
import type { OrderItemInput, OrderListParams } from '@/lib/order-status'
import { generateUniqueOrderNumber } from '@/lib/orders/order-number'

export async function listOrders(params: OrderListParams = {}) {
  await assertPermission('orders')
  const page = Math.max(1, params.page ?? 1)
  const perPage = params.perPage ?? 20
  const conditions = []

  if (params.search) {
    const s = `%${params.search}%`
    conditions.push(
      or(
        ilike(orders.orderNumber, s),
        ilike(orders.customerName, s),
        ilike(orders.customerPhone, s),
        ilike(orders.customerEmail, s),
        ilike(orders.trackingNumber, s),
      ),
    )
  }
  if (params.status && params.status !== 'all') {
    conditions.push(eq(orders.status, params.status))
  }
  const where = conditions.length ? and(...conditions) : undefined

  const [rows, countRes] = await Promise.all([
    db
      .select()
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(perPage)
      .offset((page - 1) * perPage),
    db.select({ c: sql<number>`count(*)::int` }).from(orders).where(where),
  ])

  return { items: rows, total: countRes[0]?.c ?? 0, page, perPage }
}

export async function getOrderStats() {
  await assertPermission('orders')
  const res = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'new')::int AS new,
      COUNT(*) FILTER (WHERE status NOT IN ('done','cancelled'))::int AS active,
      COALESCE(SUM(total) FILTER (WHERE payment_status = 'paid'), 0)::float AS revenue
    FROM orders
  `)
  return res.rows[0] as { total: number; new: number; active: number; revenue: number }
}

export async function getOrder(id: number) {
  await assertPermission('orders')
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
  if (!order) return null
  const [items, history] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, id)),
    db.select().from(orderHistory).where(eq(orderHistory.orderId, id)).orderBy(desc(orderHistory.createdAt)),
  ])
  const { buildOrderReceipt } = await import('@/lib/receipts/build-receipt')
  const receiptData = await buildOrderReceipt(order, items)
  const receipt = {
    storeName: receiptData.storeName,
    qrDataUrl: receiptData.qrDataUrl,
    isFiscal: receiptData.isFiscal,
  }
  return { order, items, history, receipt }
}

// Product search for the order builder.
export async function searchProductsForOrder(query: string) {
  await assertPermission('orders')
  const s = `%${query}%`
  const rows = await db
    .select({
      id: products.id,
      name: sql<string>`COALESCE(${products.nameRu}, ${products.nameUk})`,
      sku: products.sku,
      price: products.price,
      image: products.image,
      quantity: products.quantity,
    })
    .from(products)
    .where(
      and(
        sql`${products.deletedAt} IS NULL`,
        or(
          ilike(products.nameRu, s),
          ilike(products.nameUk, s),
          ilike(products.sku, s),
        ),
      ),
    )
    .limit(15)
  return rows
}

async function addHistory(orderId: number, type: string, message: string) {
  const me = await getAdminUser()
  await db.insert(orderHistory).values({
    orderId,
    type,
    message,
    actor: me?.name ?? 'Система',
  })
}

export async function createOrder(input: {
  customerId?: number
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  deliveryMethod?: string
  deliveryCity?: string
  deliveryBranch?: string
  deliveryAddress?: string
  deliveryCost?: number
  paymentMethod?: string
  paymentStatus?: string
  items: OrderItemInput[]
  note?: string
  tags?: string[]
}) {
  const me = await assertPermission('orders')
  const itemsTotal = input.items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const deliveryCost = input.deliveryCost ?? 0
  const total = itemsTotal + deliveryCost
  const itemsCount = input.items.reduce((sum, i) => sum + i.quantity, 0)
  const orderNumber = await generateUniqueOrderNumber()

  const [order] = await db
    .insert(orders)
    .values({
      orderNumber,
      status: 'new',
      customerId: input.customerId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      deliveryMethod: input.deliveryMethod,
      deliveryCity: input.deliveryCity,
      deliveryBranch: input.deliveryBranch,
      deliveryAddress: input.deliveryAddress,
      paymentMethod: input.paymentMethod,
      paymentStatus: input.paymentStatus ?? 'unpaid',
      itemsTotal: itemsTotal.toFixed(2),
      deliveryCost: deliveryCost.toFixed(2),
      total: total.toFixed(2),
      itemsCount,
      tags: input.tags ?? [],
      note: input.note,
      createdBy: me?.id,
    })
    .returning()

  if (input.items.length) {
    // Snapshot the current purchase cost of each product so profit reports
    // remain accurate even if cost prices change later.
    const costIds = input.items.map((i) => i.productId).filter((id): id is number => typeof id === 'number')
    const costRows = costIds.length
      ? await db
          .select({ id: products.id, costPrice: products.costPrice })
          .from(products)
          .where(inArray(products.id, costIds))
      : []
    const costById = new Map(costRows.map((r) => [r.id, r.costPrice]))

    await db.insert(orderItems).values(
      input.items.map((i) => {
        const cost = i.productId != null ? costById.get(i.productId) : null
        return {
          orderId: order.id,
          productId: i.productId,
          name: i.name,
          sku: i.sku,
          image: i.image,
          price: i.price.toFixed(2),
          costPrice: cost != null ? Number(cost).toFixed(2) : null,
          quantity: i.quantity,
          total: (i.price * i.quantity).toFixed(2),
        }
      }),
    )
    // Decrement stock and bump orders count for real products.
    for (const i of input.items) {
      if (i.productId) {
        await pool.query(
          `UPDATE products SET quantity = GREATEST(0, quantity - $1), orders_count = COALESCE(orders_count,0) + 1 WHERE id = $2`,
          [i.quantity, i.productId],
        )
      }
    }
  }

  // Bump customer stats.
  if (input.customerId) {
    await pool.query(
      `UPDATE customers SET orders_count = orders_count + 1, total_turnover = total_turnover + $1, last_order_date = NOW() WHERE id = $2`,
      [total, input.customerId],
    )
  }

  await addHistory(order.id, 'status', `Заказ создан (№${orderNumber})`)
  // Track order for analytics.
  await pool.query(
    `INSERT INTO analytics_events (type, order_id, amount) VALUES ('order', $1, $2)`,
    [order.id, total],
  )

  revalidatePath('/admin/orders')
  return { success: true, id: order.id, orderNumber }
}

// Adjust product stock for every real (productId-backed) line item of an
// order. `sign: 1` restores stock (order cancelled), `sign: -1` re-deducts it
// (a cancelled order gets reopened) — mirrors the deduction done in
// createOrder so stock stays accurate either direction.
async function adjustStockForOrder(orderId: number, sign: 1 | -1) {
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId))
  for (const item of items) {
    if (item.productId) {
      await pool.query(`UPDATE products SET quantity = GREATEST(0, quantity + $1::int * $2::int) WHERE id = $3`, [
        sign,
        item.quantity,
        item.productId,
      ])
    }
  }
}

export async function updateOrderStatus(id: number, status: string) {
  const user = await assertPermission('orders')
  const [current] = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
  if (!current) return { success: false, error: 'Заказ не найден' }
  await db.update(orders).set({ status, updatedAt: new Date() }).where(eq(orders.id, id))

  // Keep stock in sync with cancellations. `stockRestored` guards against
  // double-counting if the status flips back and forth (cancelled -> new ->
  // cancelled, etc).
  if (status === 'cancelled' && current.status !== 'cancelled' && !current.stockRestored) {
    await adjustStockForOrder(id, 1)
    await db.update(orders).set({ stockRestored: true }).where(eq(orders.id, id))
  } else if (status !== 'cancelled' && current.status === 'cancelled' && current.stockRestored) {
    await adjustStockForOrder(id, -1)
    await db.update(orders).set({ stockRestored: false }).where(eq(orders.id, id))
  }

  const label = ORDER_STATUSES.find((s) => s.value === status)?.label ?? status
  await addHistory(id, 'status', `Статус изменён на «${label}»`)
  const { auditLog } = await import('@/lib/audit-log')
  void auditLog({
    userId: user.id, userName: user.name, userEmail: user.email,
    action: 'update', entity: 'order', entityId: current.orderNumber,
    details: `Статус заказа: «${label}»`,
  })
  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${id}`)
  return { success: true }
}

export async function updateOrderPayment(id: number, paymentStatus: string) {
  await assertPermission('orders')
  await db.update(orders).set({ paymentStatus, updatedAt: new Date() }).where(eq(orders.id, id))
  const label = PAYMENT_STATUSES.find((s) => s.value === paymentStatus)?.label ?? paymentStatus
  await addHistory(id, 'payment', `Оплата: ${label}`)
  revalidatePath(`/admin/orders/${id}`)
  revalidatePath('/admin/orders')
  return { success: true }
}

export async function updateOrderDelivery(
  id: number,
  data: {
    deliveryMethod?: string
    deliveryCity?: string
    deliveryBranch?: string
    deliveryAddress?: string
    trackingNumber?: string
    deliveryStatus?: string
    deliveryCost?: number
  },
) {
  await assertPermission('orders')
  const set: Record<string, unknown> = { updatedAt: new Date() }
  if (data.deliveryMethod !== undefined) set.deliveryMethod = data.deliveryMethod
  if (data.deliveryCity !== undefined) set.deliveryCity = data.deliveryCity
  if (data.deliveryBranch !== undefined) set.deliveryBranch = data.deliveryBranch
  if (data.deliveryAddress !== undefined) set.deliveryAddress = data.deliveryAddress
  if (data.trackingNumber !== undefined) set.trackingNumber = data.trackingNumber
  if (data.deliveryStatus !== undefined) set.deliveryStatus = data.deliveryStatus
  await db.update(orders).set(set).where(eq(orders.id, id))
  if (data.trackingNumber) {
    await addHistory(id, 'delivery', `Создана ЭН ${data.trackingNumber}`)
  }
  revalidatePath(`/admin/orders/${id}`)
  return { success: true }
}

export async function updateOrderNote(id: number, note: string) {
  await assertPermission('orders')
  await db.update(orders).set({ note, updatedAt: new Date() }).where(eq(orders.id, id))
  revalidatePath(`/admin/orders/${id}`)
  return { success: true }
}

export async function updateOrderTags(id: number, tags: string[]) {
  await assertPermission('orders')
  await db.update(orders).set({ tags, updatedAt: new Date() }).where(eq(orders.id, id))
  revalidatePath(`/admin/orders/${id}`)
  return { success: true }
}
