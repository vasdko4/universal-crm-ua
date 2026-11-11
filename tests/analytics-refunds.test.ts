import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { financialOrdersWhere, financialPaymentsJoin, netOrderTotal } from '@/lib/analytics/financial'

const root = resolve(import.meta.dirname, '..')
// Structural tests compare source text with LF literals; normalize so the
// file also passes on a Windows CRLF checkout.
const source = (file: string) => readFileSync(resolve(root, file), 'utf8').replace(/\r\n/g, '\n')

describe('audit P1 (3.4.96): refunded money is not revenue', () => {
  describe('shared financial helpers', () => {
    it('financialOrdersWhere excludes cancelled, pending_payment and refunded', () => {
      expect(financialOrdersWhere('o')).toBe(
        "o.status NOT IN ('cancelled', 'pending_payment') AND o.payment_status <> 'refunded'",
      )
    })

    it('financialPaymentsJoin joins payments 1:1 on order_reference = order_number', () => {
      expect(financialPaymentsJoin('o', 'p')).toBe(
        'LEFT JOIN payments p ON p.order_reference = o.order_number',
      )
    })

    it('netOrderTotal nets the order total by the refunded amount', () => {
      expect(netOrderTotal('o', 'p')).toBe('(o.total - COALESCE(p.refunded_amount, 0))')
    })
  })

  describe('every financial report uses the shared predicate', () => {
    const analytics = source('app/actions/analytics.ts')

    it('all 15 filter sites use financialOrdersWhere (not the bare status exclusion)', () => {
      // getBestsellers, getStatsSummary revenue+orders, getStatsSummary
      // profit, getTimeseries, getRevenueTimeseries, getDeliveryBreakdown,
      // getPaymentBreakdown, getTopProductsPeriod, getCategorySales,
      // getCustomerInsights x3, getWeekdayActivity, getProductAnalytics,
      // getCampaignReport.
      expect(analytics.match(/financialOrdersWhere\('o'\)/g)).toHaveLength(15)
      expect(analytics).not.toContain("status NOT IN ('cancelled', 'pending_payment')")
    })

    it('order-level sums use netOrderTotal and join payments', () => {
      expect(analytics.match(/netOrderTotal\('o', 'p'\)/g)).toHaveLength(9)
      expect(analytics.match(/financialPaymentsJoin\('o', 'p'\)/g)).toHaveLength(8)
    })

    it('the funnel "placed" semantics are unchanged', () => {
      // A refunded order was placed — it counts as placed, never as paid.
      const funnel = analytics.slice(
        analytics.indexOf('funnelOrdersRes'),
        analytics.indexOf('const profitRes'),
      )
      expect(funnel).toContain("COUNT(*) FILTER (WHERE status <> 'cancelled')::int AS placed")
      expect(funnel).toContain("payment_status = 'paid')::int AS paid")
      expect(funnel).not.toContain('financialOrdersWhere')
    })

    it('getOrderStatusBreakdown stays a status census (no refund filter)', () => {
      const fn = analytics.slice(
        analytics.indexOf('export async function getOrderStatusBreakdown'),
        analytics.indexOf('export async function getDeliveryBreakdown'),
      )
      expect(fn).not.toContain('refunded')
      expect(fn).not.toContain('financialOrdersWhere')
    })
  })

  describe('manual refund stamps payments.refunded_amount', () => {
    const orders = source('app/actions/orders.ts')

    it('updateOrderPayment stamps refunded_amount = amount on the payment row', () => {
      const fn = orders.slice(
        orders.indexOf('export async function updateOrderPayment'),
        orders.indexOf('export async function updateOrderPayment') + 9000,
      )
      expect(fn).toContain("if (paymentStatus === 'refunded')")
      expect(fn).toContain('.set({ refundedAmount: payment.amount, updatedAt: new Date() })')
      expect(fn).toContain('eq(payments.orderReference, current.orderNumber)')
    })

    it('no code introduces orders.status = refunded', () => {
      // Refund state lives on payment_status by design (ORDER_STATUSES has
      // no 'refunded' value); the fix must not smuggle one in.
      expect(orders).not.toContain("status: 'refunded'")
      expect(orders).not.toContain(".status = 'refunded'")
      expect(source('app/actions/analytics.ts')).not.toContain("status: 'refunded'")
    })
  })
})

// Live tests run the SHIPPED helpers against minimal orders/payments/
// order_items tables seeded with the refund shapes the fix handles.
// Same probe pattern as tests/db-restore-backup.test.ts; skip when no
// server answers.
const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/postgres'

type PgPool = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>
  end: () => Promise<void>
}
let PoolCtor: (new (opts: { connectionString: string; connectionTimeoutMillis?: number }) => PgPool) | null = null
let dbAvailable = false
try {
  const pg = await import('pg')
  PoolCtor = pg.Pool as unknown as typeof PoolCtor
  const probe = new pg.Pool({ connectionString: TEST_DB_URL, connectionTimeoutMillis: 2000 })
  await probe.query('SELECT 1')
  await probe.end()
  dbAvailable = true
} catch {
  dbAvailable = false
}
const describeDb = dbAvailable ? describe : describe.skip

describeDb('audit P1 (3.4.96): refunds live against Postgres', () => {
  let pool: PgPool
  beforeAll(async () => {
    pool = new PoolCtor!({ connectionString: TEST_DB_URL })
    await pool.query(`DROP TABLE IF EXISTS stats_test_order_items`)
    await pool.query(`DROP TABLE IF EXISTS stats_test_payments`)
    await pool.query(`DROP TABLE IF EXISTS stats_test_orders`)
    await pool.query(`CREATE TABLE stats_test_orders (
      id serial PRIMARY KEY, order_number text UNIQUE NOT NULL,
      status text NOT NULL, payment_status text NOT NULL,
      total numeric(12,2) NOT NULL, created_at timestamptz NOT NULL DEFAULT NOW())`)
    await pool.query(`CREATE TABLE stats_test_payments (
      id serial PRIMARY KEY, order_reference text UNIQUE NOT NULL,
      amount numeric(12,2) NOT NULL, refunded_amount numeric(12,2) NOT NULL DEFAULT 0)`)
    await pool.query(`CREATE TABLE stats_test_order_items (
      id serial PRIMARY KEY, order_id int NOT NULL,
      quantity int NOT NULL, total numeric(12,2) NOT NULL,
      cost_price numeric(12,2) NOT NULL)`)
  })
  afterAll(async () => {
    await pool.query(`DROP TABLE IF EXISTS stats_test_order_items`)
    await pool.query(`DROP TABLE IF EXISTS stats_test_payments`)
    await pool.query(`DROP TABLE IF EXISTS stats_test_orders`)
    await pool.end()
  })

  // A paid 1000 (payment, refunded 0) — counts in full.
  // B shipped 2000, payment_status refunded, refunded 2000 — excluded.
  // C new 1500, partially_refunded, refunded 500 — counts at 1000.
  // D cancelled 999 — excluded. E pending_payment 888 — excluded
  // (pending_payment is an ORDER status, not a payment status).
  // F paid 700, NO payment row (cash on delivery) — counts in full.
  // Items: A 2 x 250 (cost 100), B 1 x 2000 (cost 1500), C 3 x 500 (cost 200).
  beforeEach(async () => {
    await pool.query(`TRUNCATE stats_test_order_items, stats_test_payments, stats_test_orders RESTART IDENTITY`)
    await pool.query(`INSERT INTO stats_test_orders (order_number, status, payment_status, total) VALUES
      ('A', 'done', 'paid', 1000), ('B', 'shipped', 'refunded', 2000),
      ('C', 'new', 'partially_refunded', 1500), ('D', 'cancelled', 'paid', 999),
      ('E', 'pending_payment', 'unpaid', 888), ('F', 'done', 'paid', 700)`)
    await pool.query(`INSERT INTO stats_test_payments (order_reference, amount, refunded_amount) VALUES
      ('A', 1000, 0), ('B', 2000, 2000), ('C', 1500, 500), ('D', 999, 0), ('E', 888, 0)`)
    await pool.query(`INSERT INTO stats_test_order_items (order_id, quantity, total, cost_price) VALUES
      (1, 2, 500, 100), (2, 1, 2000, 1500), (3, 3, 1500, 200)`)
  })

  // Same shape as the getStatsSummary revenue query (no window filter —
  // every seeded row is in scope). The shipped join names the real
  // `payments` table; the test tables carry a stats_test_ prefix, so the
  // table name is substituted here — the exact shipped string is covered
  // by the unit test above, and the predicate/net expressions are verbatim.
  const testJoin = financialPaymentsJoin('o', 'p').replace('payments p', 'stats_test_payments p')
  const orderLevel = () =>
    pool.query(
      `SELECT COUNT(*)::int AS orders,
              COALESCE(SUM(${netOrderTotal('o', 'p')}), 0)::float AS revenue,
              COALESCE(SUM(p.refunded_amount), 0)::float AS refunded
       FROM stats_test_orders o
       ${testJoin}
       WHERE ${financialOrdersWhere('o')}`,
    )

  it('fully-refunded orders are excluded, partials count at net value, COD counts', async () => {
    const { rows } = await orderLevel()
    expect(rows[0].orders).toBe(3) // A, C, F
    expect(rows[0].revenue).toBe(2700) // 1000 + (1500 - 500) + 700
    expect(rows[0].refunded).toBe(500) // only the partial refund
  })

  it('item-level aggregates exclude fully-refunded orders', async () => {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(oi.total), 0)::float AS revenue,
              COALESCE(SUM(oi.quantity), 0)::int AS units
       FROM stats_test_order_items oi
       JOIN stats_test_orders o ON o.id = oi.order_id
       WHERE ${financialOrdersWhere('o')}`,
    )
    expect(rows[0].revenue).toBe(2000) // 500 (A) + 1500 (C); B's 2000 is out
    expect(rows[0].units).toBe(5) // 2 + 3
  })

  it('profit nets partial refunds via a separate aggregate (no items fan-out)', async () => {
    // getStatsSummary subtracts the refunded sum from a SEPARATE orders
    // aggregate in JS: joining payments into the items query would
    // multiply each refund by the order's item-row count.
    const { rows: itemRows } = await pool.query(
      `SELECT COALESCE(SUM(oi.total - oi.cost_price * oi.quantity), 0)::float AS profit
       FROM stats_test_order_items oi
       JOIN stats_test_orders o ON o.id = oi.order_id
       WHERE ${financialOrdersWhere('o')}`,
    )
    const { rows } = await orderLevel()
    expect(itemRows[0].profit).toBe(1200) // (500-200) + (1500-600)
    expect(rows[0].revenue - rows[0].refunded).toBe(2200)
    expect(itemRows[0].profit - rows[0].refunded).toBe(700) // net profit
  })

  it('the manual-refund stamp removes the order from financials', async () => {
    // Mirrors updateOrderPayment('refunded'): flip payment_status AND
    // stamp payments.refunded_amount = amount in the same transaction.
    // (Without the stamp, the refunded sum above would stay 500 and the
    // order would still count at its full 1000.)
    await pool.query(`UPDATE stats_test_orders SET payment_status = 'refunded' WHERE order_number = 'A'`)
    await pool.query(
      `UPDATE stats_test_payments SET refunded_amount = amount WHERE order_reference = 'A'`,
    )
    const { rows: payRows } = await pool.query(
      `SELECT refunded_amount::float AS r FROM stats_test_payments WHERE order_reference = 'A'`,
    )
    expect(payRows[0].r).toBe(1000)
    const { rows } = await orderLevel()
    expect(rows[0].orders).toBe(2) // C, F
    expect(rows[0].revenue).toBe(1700) // 1000 + 700
  })
})
