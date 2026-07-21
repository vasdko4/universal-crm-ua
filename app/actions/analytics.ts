'use server'

import { pool } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { assertPermission, getAdminUser } from '@/lib/session'
import { hasPermission } from '@/lib/permissions'

// getStatsSummary() backs both /admin (dashboard) and /admin/statistics, which
// are gated by different permissions — a 'manager' role has 'dashboard' but
// not 'statistics', for example. Accept either rather than picking one and
// breaking the other page for roles that only have one of the two.
async function assertDashboardOrStatistics() {
  const user = await getAdminUser()
  if (!user) throw new Error('Не авторизовано')
  if (!hasPermission(user.permissions, 'dashboard') && !hasPermission(user.permissions, 'statistics')) {
    throw new Error('Нет прав доступа: dashboard/statistics')
  }
  return user
}

export type BestsellerRow = {
  productId: number | null
  name: string
  image: string | null
  price: number
  unitsSold: number
  revenue: number
  ordersCount: number
  isPopular: boolean
}

// Real bestsellers computed from paid/completed order items, enriched with the
// product record so we can show image, price and the "top sale" flag.
export async function getBestsellers(limit = 20): Promise<BestsellerRow[]> {
  await assertPermission('bestsellers')
  const res = await pool.query(
    `SELECT
       oi.product_id AS product_id,
       COALESCE(p.name_ru, p.name_uk, oi.name) AS name,
       COALESCE(p.image, oi.image) AS image,
       COALESCE(p.price, oi.price)::float AS price,
       SUM(oi.quantity)::int AS units_sold,
       SUM(oi.total)::float AS revenue,
       COUNT(DISTINCT oi.order_id)::int AS orders_count,
       COALESCE(p.is_popular, false) AS is_popular
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE o.status <> 'cancelled'
     GROUP BY oi.product_id, p.name_ru, p.name_uk, oi.name, p.image, oi.image, p.price, oi.price, p.is_popular
     ORDER BY units_sold DESC
     LIMIT $1`,
    [limit],
  )
  return res.rows.map((r) => ({
    productId: r.product_id,
    name: r.name,
    image: r.image,
    price: r.price ?? 0,
    unitsSold: r.units_sold ?? 0,
    revenue: r.revenue ?? 0,
    ordersCount: r.orders_count ?? 0,
    isPopular: r.is_popular ?? false,
  }))
}

export async function toggleProductPopular(productId: number, value: boolean) {
  await assertPermission('bestsellers')
  await pool.query(`UPDATE products SET is_popular = $1 WHERE id = $2`, [value, productId])
  revalidatePath('/admin/bestsellers')
  revalidatePath('/admin/products')
  return { success: true }
}

export type StatsSummary = {
  pageViews: number
  productViews: number
  addToCarts: number
  orders: number
  revenue: number
  /** Total purchase cost of sold items over the period. */
  costTotal: number
  /** Net profit: revenue minus purchase costs (закупка). */
  profit: number
  /** Profit margin as a percentage of revenue. */
  profitMargin: number
  visitors: number
  conversionRate: number
  cartConversion: number
  /** Percentage change vs the previous period of the same length (null = no data). */
  trends: {
    pageViews: number | null
    visitors: number | null
    orders: number | null
    revenue: number | null
    profit: number | null
  }
}

export type TimeseriesPoint = { date: string; pageViews: number; visitors: number; orders: number }
export type TopPathRow = { path: string; views: number }
export type ReferrerRow = { source: string; visits: number }

function trend(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return ((current - previous) / previous) * 100
}

export async function getStatsSummary(days = 30): Promise<StatsSummary> {
  await assertDashboardOrStatistics()
  // Traffic counters (pageviews/product views/add-to-cart/visitors) come from
  // analytics_events, which client-side tracking actually writes to.
  //
  // Orders/revenue used to also be read from analytics_events (type='order'),
  // but nothing in the app ever writes an 'order' analytics event — client
  // tracking explicitly never sends order/amount data ("written server-side"
  // per a comment in app/api/track/route.ts), and no server code calls
  // trackEvent with type 'order' either. That silently pinned the "Заказы"
  // and "Выручка за период" summary cards, the conversion rates, and the
  // sales-funnel step to zero forever, even with real sales — while the
  // extended reports below (getRevenueTimeseries, getOrderStatusBreakdown,
  // etc.) correctly read straight from the `orders` table. Now orders/revenue
  // here are computed the same way, from real orders (excluding cancelled and
  // not-yet-paid online orders, consistent with the rest of this file).
  const [trafficRes, ordersRes] = await Promise.all([
    pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE type = 'pageview' AND created_at >= NOW() - ($1 || ' days')::interval)::int AS page_views,
        COUNT(*) FILTER (WHERE type = 'product_view' AND created_at >= NOW() - ($1 || ' days')::interval)::int AS product_views,
        COUNT(*) FILTER (WHERE type = 'add_to_cart' AND created_at >= NOW() - ($1 || ' days')::interval)::int AS add_to_carts,
        COUNT(DISTINCT session_id) FILTER (WHERE type = 'pageview' AND session_id IS NOT NULL AND created_at >= NOW() - ($1 || ' days')::interval)::int AS visitors,
        COUNT(*) FILTER (WHERE type = 'pageview' AND created_at >= NOW() - ($1::int * 2 || ' days')::interval AND created_at < NOW() - ($1 || ' days')::interval)::int AS prev_page_views,
        COUNT(DISTINCT session_id) FILTER (WHERE type = 'pageview' AND session_id IS NOT NULL AND created_at >= NOW() - ($1::int * 2 || ' days')::interval AND created_at < NOW() - ($1 || ' days')::interval)::int AS prev_visitors
       FROM analytics_events
       WHERE created_at >= NOW() - ($1::int * 2 || ' days')::interval`,
      [days],
    ),
    pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE created_at >= NOW() - ($1 || ' days')::interval)::int AS orders,
        COALESCE(SUM(total) FILTER (WHERE created_at >= NOW() - ($1 || ' days')::interval), 0)::float AS revenue,
        COUNT(*) FILTER (WHERE created_at >= NOW() - ($1::int * 2 || ' days')::interval AND created_at < NOW() - ($1 || ' days')::interval)::int AS prev_orders,
        COALESCE(SUM(total) FILTER (WHERE created_at >= NOW() - ($1::int * 2 || ' days')::interval AND created_at < NOW() - ($1 || ' days')::interval), 0)::float AS prev_revenue
       FROM orders
       WHERE status NOT IN ('cancelled', 'pending_payment')
         AND created_at >= NOW() - ($1::int * 2 || ' days')::interval`,
      [days],
    ),
  ])
  const r = { ...trafficRes.rows[0], ...ordersRes.rows[0] }

  // Net profit from real order items: sale price minus the purchase-cost
  // snapshot (falls back to the product's current cost for older orders).
  const profitRes = await pool.query(
    `SELECT
      COALESCE(SUM(oi.total) FILTER (WHERE o.created_at >= NOW() - ($1 || ' days')::interval), 0)::float AS items_revenue,
      COALESCE(SUM(COALESCE(oi.cost_price, p.cost_price, 0) * oi.quantity) FILTER (WHERE o.created_at >= NOW() - ($1 || ' days')::interval), 0)::float AS cost_total,
      COALESCE(SUM(oi.total - COALESCE(oi.cost_price, p.cost_price, 0) * oi.quantity) FILTER (WHERE o.created_at >= NOW() - ($1 || ' days')::interval), 0)::float AS profit,
      COALESCE(SUM(oi.total - COALESCE(oi.cost_price, p.cost_price, 0) * oi.quantity) FILTER (WHERE o.created_at >= NOW() - ($1::int * 2 || ' days')::interval AND o.created_at < NOW() - ($1 || ' days')::interval), 0)::float AS prev_profit
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE o.status NOT IN ('cancelled', 'pending_payment')
       AND o.created_at >= NOW() - ($1::int * 2 || ' days')::interval`,
    [days],
  )
  const pr = profitRes.rows[0]
  const costTotal = pr.cost_total ?? 0
  const profit = pr.profit ?? 0
  const itemsRevenue = pr.items_revenue ?? 0

  const pageViews = r.page_views ?? 0
  const orders = r.orders ?? 0
  const addToCarts = r.add_to_carts ?? 0
  const revenue = r.revenue ?? 0
  const visitors = r.visitors ?? 0
  return {
    pageViews,
    productViews: r.product_views ?? 0,
    addToCarts,
    orders,
    revenue,
    costTotal,
    profit,
    profitMargin: itemsRevenue > 0 ? (profit / itemsRevenue) * 100 : 0,
    visitors,
    conversionRate: pageViews > 0 ? (orders / pageViews) * 100 : 0,
    cartConversion: addToCarts > 0 ? (orders / addToCarts) * 100 : 0,
    trends: {
      pageViews: trend(pageViews, r.prev_page_views ?? 0),
      visitors: trend(visitors, r.prev_visitors ?? 0),
      orders: trend(orders, r.prev_orders ?? 0),
      revenue: trend(revenue, r.prev_revenue ?? 0),
      profit: trend(profit, pr.prev_profit ?? 0),
    },
  }
}

// Where visitors come from: normalized referrer hosts ("direct" if none).
export async function getTopReferrers(days = 30, limit = 8): Promise<ReferrerRow[]> {
  await assertPermission('statistics')
  const res = await pool.query(
    `SELECT
       COALESCE(NULLIF(regexp_replace(referrer, '^https?://(www\\.)?([^/]+).*$', '\\2'), ''), 'Прямые заходы') AS source,
       COUNT(*)::int AS visits
     FROM analytics_events
     WHERE type = 'pageview'
       AND created_at >= NOW() - ($1 || ' days')::interval
     GROUP BY source
     ORDER BY visits DESC
     LIMIT $2`,
    [days, limit],
  )
  return res.rows.map((r) => ({ source: r.source, visits: r.visits }))
}

export async function getTimeseries(days = 30): Promise<TimeseriesPoint[]> {
  await assertPermission('statistics')
  // Pageviews/visitors from analytics_events (actually tracked); orders from
  // the real `orders` table — analytics_events never gets an 'order' event
  // written anywhere, so that column was always zero (see getStatsSummary).
  // Pre-aggregated per day in separate CTEs (not a single 3-way join on date)
  // so per-day event/order counts never fan out against each other.
  const res = await pool.query(
    `WITH days AS (
       SELECT generate_series(
         date_trunc('day', NOW() - ($1 || ' days')::interval),
         date_trunc('day', NOW()),
         '1 day'
       ) AS day
     ),
     events_by_day AS (
       SELECT date_trunc('day', created_at) AS day,
              COUNT(*) FILTER (WHERE type = 'pageview') AS page_views,
              COUNT(DISTINCT session_id) FILTER (WHERE type = 'pageview' AND session_id IS NOT NULL) AS visitors
       FROM analytics_events
       WHERE created_at >= date_trunc('day', NOW() - ($1 || ' days')::interval)
       GROUP BY 1
     ),
     orders_by_day AS (
       SELECT date_trunc('day', created_at) AS day, COUNT(*) AS orders
       FROM orders
       WHERE status NOT IN ('cancelled', 'pending_payment')
         AND created_at >= date_trunc('day', NOW() - ($1 || ' days')::interval)
       GROUP BY 1
     )
     SELECT
       to_char(d.day, 'YYYY-MM-DD') AS date,
       COALESCE(ev.page_views, 0)::int AS page_views,
       COALESCE(ev.visitors, 0)::int AS visitors,
       COALESCE(ob.orders, 0)::int AS orders
     FROM days d
     LEFT JOIN events_by_day ev ON ev.day = d.day
     LEFT JOIN orders_by_day ob ON ob.day = d.day
     ORDER BY d.day ASC`,
    [days],
  )
  return res.rows.map((row) => ({
    date: row.date,
    pageViews: row.page_views,
    visitors: row.visitors,
    orders: row.orders,
  }))
}

export async function getTopPaths(days = 30, limit = 8): Promise<TopPathRow[]> {
  await assertPermission('statistics')
  const res = await pool.query(
    `SELECT path, COUNT(*)::int AS views
     FROM analytics_events
     WHERE type = 'pageview' AND path IS NOT NULL
       AND created_at >= NOW() - ($1 || ' days')::interval
     GROUP BY path
     ORDER BY views DESC
     LIMIT $2`,
    [days, limit],
  )
  return res.rows.map((r) => ({ path: r.path, views: r.views }))
}

// Whitelisted event types — anything else is rejected to keep the table clean.
const ALLOWED_EVENT_TYPES = new Set(['pageview', 'product_view', 'add_to_cart', 'order'])

// Public tracker (called from storefront or other apps via API).
export async function trackEvent(input: {
  type: string
  path?: string
  productId?: number
  orderId?: number
  amount?: number
  sessionId?: string
  referrer?: string
}) {
  if (!ALLOWED_EVENT_TYPES.has(input.type)) {
    return { success: false, error: 'Неизвестный тип события' }
  }
  const path = typeof input.path === 'string' ? input.path.slice(0, 500) : null
  const sessionId = typeof input.sessionId === 'string' ? input.sessionId.slice(0, 64) : null
  const referrer = typeof input.referrer === 'string' ? input.referrer.slice(0, 300) : null
  const productId = Number.isInteger(input.productId) ? input.productId : null
  const orderId = Number.isInteger(input.orderId) ? input.orderId : null
  const amount = typeof input.amount === 'number' && Number.isFinite(input.amount) ? input.amount : null
  await pool.query(
    `INSERT INTO analytics_events (type, path, product_id, order_id, amount, session_id, referrer)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [input.type, path, productId, orderId, amount, sessionId, referrer],
  )
  // Keep the denormalized per-product view counter in sync for quick sorting.
  if (input.type === 'product_view' && productId) {
    await pool.query(
      `UPDATE products SET views_count = COALESCE(views_count, 0) + 1 WHERE id = $1`,
      [productId],
    )
  }
  return { success: true }
}

/* --------------------- Extended store statistics (admin) --------------------- */

export type RevenuePoint = { date: string; revenue: number; profit: number; orders: number }

// Daily revenue/profit/orders from real orders (not analytics events).
export async function getRevenueTimeseries(days = 30): Promise<RevenuePoint[]> {
  await assertPermission('statistics')
  const res = await pool.query(
    `SELECT
      to_char(d.day, 'YYYY-MM-DD') AS date,
      COALESCE(SUM(o.total) FILTER (WHERE o.id IS NOT NULL), 0)::float AS revenue,
      COALESCE(SUM(op.profit), 0)::float AS profit,
      COUNT(DISTINCT o.id)::int AS orders
     FROM generate_series(
       date_trunc('day', NOW() - ($1 || ' days')::interval),
       date_trunc('day', NOW()),
       '1 day'
     ) AS d(day)
     LEFT JOIN orders o
       ON date_trunc('day', o.created_at) = d.day
      AND o.status NOT IN ('cancelled', 'pending_payment')
     LEFT JOIN LATERAL (
       SELECT SUM(oi.total - COALESCE(oi.cost_price, p.cost_price, 0) * oi.quantity) AS profit
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = o.id
     ) op ON TRUE
     GROUP BY d.day
     ORDER BY d.day ASC`,
    [days],
  )
  return res.rows.map((r) => ({
    date: r.date,
    revenue: r.revenue ?? 0,
    profit: r.profit ?? 0,
    orders: r.orders ?? 0,
  }))
}

export type OrderStatusRow = { status: string; count: number; total: number }

export async function getOrderStatusBreakdown(days = 30): Promise<OrderStatusRow[]> {
  await assertPermission('statistics')
  const res = await pool.query(
    `SELECT status, COUNT(*)::int AS count, COALESCE(SUM(total), 0)::float AS total
     FROM orders
     WHERE created_at >= NOW() - ($1 || ' days')::interval
     GROUP BY status
     ORDER BY count DESC`,
    [days],
  )
  return res.rows.map((r) => ({ status: r.status, count: r.count, total: r.total }))
}

export type MethodBreakdownRow = { method: string; count: number; total: number }

export async function getDeliveryBreakdown(days = 30): Promise<MethodBreakdownRow[]> {
  await assertPermission('statistics')
  const res = await pool.query(
    `SELECT COALESCE(NULLIF(delivery_method, ''), 'не указано') AS method,
            COUNT(*)::int AS count, COALESCE(SUM(total), 0)::float AS total
     FROM orders
     WHERE created_at >= NOW() - ($1 || ' days')::interval
       AND status NOT IN ('cancelled', 'pending_payment')
     GROUP BY 1 ORDER BY count DESC`,
    [days],
  )
  return res.rows.map((r) => ({ method: r.method, count: r.count, total: r.total }))
}

export async function getPaymentBreakdown(days = 30): Promise<MethodBreakdownRow[]> {
  await assertPermission('statistics')
  const res = await pool.query(
    `SELECT COALESCE(NULLIF(payment_method, ''), 'не указано') AS method,
            COUNT(*)::int AS count, COALESCE(SUM(total), 0)::float AS total
     FROM orders
     WHERE created_at >= NOW() - ($1 || ' days')::interval
       AND status NOT IN ('cancelled', 'pending_payment')
     GROUP BY 1 ORDER BY count DESC`,
    [days],
  )
  return res.rows.map((r) => ({ method: r.method, count: r.count, total: r.total }))
}

export type TopProductRow = {
  productId: number | null
  name: string
  image: string | null
  unitsSold: number
  revenue: number
  profit: number
}

// Top products by revenue for the selected period.
export async function getTopProductsPeriod(days = 30, limit = 10): Promise<TopProductRow[]> {
  await assertPermission('statistics')
  const res = await pool.query(
    `SELECT
       oi.product_id,
       COALESCE(p.name_ru, p.name_uk, oi.name) AS name,
       COALESCE(p.image, oi.image) AS image,
       SUM(oi.quantity)::int AS units_sold,
       SUM(oi.total)::float AS revenue,
       SUM(oi.total - COALESCE(oi.cost_price, p.cost_price, 0) * oi.quantity)::float AS profit
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE o.status NOT IN ('cancelled', 'pending_payment')
       AND o.created_at >= NOW() - ($1 || ' days')::interval
     GROUP BY oi.product_id, p.name_ru, p.name_uk, oi.name, p.image, oi.image
     ORDER BY revenue DESC
     LIMIT $2`,
    [days, limit],
  )
  return res.rows.map((r) => ({
    productId: r.product_id,
    name: r.name,
    image: r.image,
    unitsSold: r.units_sold ?? 0,
    revenue: r.revenue ?? 0,
    profit: r.profit ?? 0,
  }))
}

export type CategorySalesRow = { name: string; unitsSold: number; revenue: number }

// Revenue per category over the period (products may sit in multiple categories —
// we attribute the sale to each linked category once).
export async function getCategorySales(days = 30, limit = 8): Promise<CategorySalesRow[]> {
  await assertPermission('statistics')
  const res = await pool.query(
    `SELECT
       COALESCE(c.name_ru, c.name_uk) AS name,
       SUM(oi.quantity)::int AS units_sold,
       SUM(oi.total)::float AS revenue
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN product_category pc ON pc.product_id = oi.product_id
     JOIN categories c ON c.id = pc.category_id
     WHERE o.status NOT IN ('cancelled', 'pending_payment')
       AND o.created_at >= NOW() - ($1 || ' days')::interval
     GROUP BY c.id, c.name_ru, c.name_uk
     ORDER BY revenue DESC
     LIMIT $2`,
    [days, limit],
  )
  return res.rows.map((r) => ({ name: r.name, unitsSold: r.units_sold ?? 0, revenue: r.revenue ?? 0 }))
}

export type CustomerInsights = {
  totalOrders: number
  uniqueCustomers: number
  newCustomers: number
  returningCustomers: number
  avgOrderValue: number
  avgItemsPerOrder: number
  topCustomers: { name: string; phone: string; orders: number; total: number }[]
}

export async function getCustomerInsights(days = 30): Promise<CustomerInsights> {
  await assertPermission('statistics')
  const [agg, top] = await Promise.all([
    pool.query(
      `WITH period_orders AS (
         SELECT * FROM orders
         WHERE created_at >= NOW() - ($1 || ' days')::interval
           AND status NOT IN ('cancelled', 'pending_payment')
       ),
       customer_first AS (
         SELECT customer_phone, MIN(created_at) AS first_order
         FROM orders
         WHERE status NOT IN ('cancelled', 'pending_payment')
         GROUP BY customer_phone
       )
       SELECT
         (SELECT COUNT(*) FROM period_orders)::int AS total_orders,
         (SELECT COUNT(DISTINCT customer_phone) FROM period_orders)::int AS unique_customers,
         (SELECT COUNT(*) FROM customer_first
           WHERE first_order >= NOW() - ($1 || ' days')::interval)::int AS new_customers,
         COALESCE((SELECT AVG(total) FROM period_orders), 0)::float AS avg_order_value,
         COALESCE((SELECT AVG(items_count) FROM period_orders), 0)::float AS avg_items`,
      [days],
    ),
    pool.query(
      `SELECT customer_name AS name, customer_phone AS phone,
              COUNT(*)::int AS orders, COALESCE(SUM(total), 0)::float AS total
       FROM orders
       WHERE created_at >= NOW() - ($1 || ' days')::interval
         AND status NOT IN ('cancelled', 'pending_payment')
       GROUP BY customer_name, customer_phone
       ORDER BY total DESC
       LIMIT 5`,
      [days],
    ),
  ])
  const a = agg.rows[0]
  const uniqueCustomers = a.unique_customers ?? 0
  const newCustomers = Math.min(a.new_customers ?? 0, uniqueCustomers)
  return {
    totalOrders: a.total_orders ?? 0,
    uniqueCustomers,
    newCustomers,
    returningCustomers: Math.max(uniqueCustomers - newCustomers, 0),
    avgOrderValue: a.avg_order_value ?? 0,
    avgItemsPerOrder: a.avg_items ?? 0,
    topCustomers: top.rows.map((r) => ({
      name: r.name ?? '—',
      phone: r.phone ?? '',
      orders: r.orders,
      total: r.total,
    })),
  }
}

export type WeekdayRow = { weekday: number; orders: number; revenue: number }

// Orders per day of week (1 = Monday ... 7 = Sunday).
export async function getWeekdayActivity(days = 30): Promise<WeekdayRow[]> {
  await assertPermission('statistics')
  const res = await pool.query(
    `SELECT EXTRACT(ISODOW FROM created_at)::int AS weekday,
            COUNT(*)::int AS orders, COALESCE(SUM(total), 0)::float AS revenue
     FROM orders
     WHERE created_at >= NOW() - ($1 || ' days')::interval
       AND status NOT IN ('cancelled', 'pending_payment')
     GROUP BY 1 ORDER BY 1`,
    [days],
  )
  const map = new Map(res.rows.map((r) => [r.weekday, r]))
  return Array.from({ length: 7 }, (_, i) => {
    const row = map.get(i + 1)
    return { weekday: i + 1, orders: row?.orders ?? 0, revenue: row?.revenue ?? 0 }
  })
}

export type AbandonedCartStats = { count: number; total: number }

export async function getAbandonedCartStats(days = 30): Promise<AbandonedCartStats> {
  await assertPermission('statistics')
  const res = await pool.query(
    `SELECT COUNT(*)::int AS count, COALESCE(SUM(total), 0)::float AS total
     FROM abandoned_carts
     WHERE created_at >= NOW() - ($1 || ' days')::interval`,
    [days],
  ).catch(() => ({ rows: [{ count: 0, total: 0 }] }))
  return { count: res.rows[0].count ?? 0, total: res.rows[0].total ?? 0 }
}

/* --------------------- Per-product analytics (admin) --------------------- */

export type ProductAnalytics = {
  views: number
  addToCarts: number
  unitsSold: number
  revenue: number
  ordersCount: number
  cartRate: number // add_to_cart / views
  purchaseRate: number // orders / views
}

// Aggregated funnel for a single product over the given period (days).
export async function getProductAnalytics(productId: number, days = 30): Promise<ProductAnalytics> {
  await assertPermission('products')
  const [events, sales] = await Promise.all([
    pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE type = 'product_view')::int AS views,
        COUNT(*) FILTER (WHERE type = 'add_to_cart')::int AS add_to_carts
       FROM analytics_events
       WHERE product_id = $1 AND created_at >= NOW() - ($2 || ' days')::interval`,
      [productId, days],
    ),
    pool.query(
      `SELECT
        COALESCE(SUM(oi.quantity), 0)::int AS units_sold,
        COALESCE(SUM(oi.total), 0)::float AS revenue,
        COUNT(DISTINCT oi.order_id)::int AS orders_count
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE oi.product_id = $1
         AND o.status <> 'cancelled'
         AND o.created_at >= NOW() - ($2 || ' days')::interval`,
      [productId, days],
    ),
  ])
  const e = events.rows[0]
  const s = sales.rows[0]
  const views = e.views ?? 0
  const addToCarts = e.add_to_carts ?? 0
  const ordersCount = s.orders_count ?? 0
  return {
    views,
    addToCarts,
    unitsSold: s.units_sold ?? 0,
    revenue: s.revenue ?? 0,
    ordersCount,
    cartRate: views > 0 ? (addToCarts / views) * 100 : 0,
    purchaseRate: views > 0 ? (ordersCount / views) * 100 : 0,
  }
}

// Views per product over the period — used for the admin products table column.
export async function getProductViewCounts(
  productIds: number[],
  days = 30,
): Promise<Record<number, number>> {
  await assertPermission('products')
  if (!productIds.length) return {}
  const res = await pool.query(
    `SELECT product_id, COUNT(*)::int AS views
     FROM analytics_events
     WHERE type = 'product_view'
       AND product_id = ANY($1::int[])
       AND created_at >= NOW() - ($2 || ' days')::interval
     GROUP BY product_id`,
    [productIds, days],
  )
  const map: Record<number, number> = {}
  for (const row of res.rows) map[row.product_id] = row.views
  return map
}
