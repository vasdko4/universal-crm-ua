// Live test: promo usage reservations (3.4.109).
//
// Needs a reachable Postgres with the 3.4.109 migration applied. Run with
// the scratch DB, e.g.:
//   set -a; source .env.e2e; npx vitest run tests/promo-reservations.test.ts
// (TEST_DATABASE_URL overrides DATABASE_URL.) The test only ever touches
// rows it creates itself (prefix `TPR-<ts>-`) and deletes them afterwards —
// CI has no Postgres service, so it skips there.
import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest'
import type { PoolClient } from 'pg'

// next/cache is imported at module scope by lib/store-settings (via
// lib/server-errors <- lib/shop/stock-ledger <- order-fulfillment), which
// calls unstable_cache at module scope — stub it as identity.
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}))

const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? ''

let PoolCtor: (new (opts: { connectionString: string; connectionTimeoutMillis?: number }) => {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>
  connect: () => Promise<PoolClient>
  end: () => Promise<void>
}) | null = null
let dbAvailable = false
try {
  const pg = await import('pg')
  PoolCtor = pg.Pool
  const probe = new pg.Pool({ connectionString: TEST_DB_URL, connectionTimeoutMillis: 2000 })
  await probe.query('SELECT 1')
  // The 3.4.109 migration must be applied to this database.
  const table = await probe.query(`SELECT to_regclass('public.promotion_reservations') AS t`)
  dbAvailable = table.rows[0]?.t != null
  await probe.end()
} catch {
  dbAvailable = false
}
const describeDb = dbAvailable ? describe : describe.skip

type Q = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>
}

describeDb('promo usage reservations (3.4.109): live', () => {
  const run = `TPR-${Date.now()}`
  let pool: {
    query: Q['query']
    connect: () => Promise<PoolClient>
    end: () => Promise<void>
  }
  const promoIds: number[] = []
  const orderNumbers: string[] = []
  let n = 0
  const nextNum = () => `${run}-${++n}`

  const makePromo = async (usageLimit: number | null, code?: string) => {
    const promoCode = code ?? `${run}-C${++n}`
    const p = await pool.query(
      `INSERT INTO promotions (type, name, discount_type, discount_value, promo_code, target_type, usage_limit, is_active)
       VALUES ('promocode', $1, 'percentage', 10, $2, 'all', $3, true) RETURNING id`,
      [`Test reservation ${promoCode}`, promoCode, usageLimit],
    )
    const id = Number(p.rows[0]?.id)
    promoIds.push(id)
    return { id, code: promoCode }
  }

  const makeOrder = async (input: {
    promoCode?: string | null
    discountTotal?: number
    total?: number
    status?: string
  }) => {
    const orderNumber = nextNum()
    const o = await pool.query(
      `INSERT INTO orders (order_number, status, payment_status, promo_code, discount_total, total, customer_name)
       VALUES ($1, $2, 'unpaid', $3, $4, $5, 'Test') RETURNING id`,
      [
        orderNumber,
        input.status ?? 'pending_payment',
        input.promoCode ?? null,
        String(input.discountTotal ?? 10),
        String(input.total ?? 100),
      ],
    )
    const id = Number(o.rows[0]?.id)
    orderNumbers.push(orderNumber)
    return {
      orderId: id,
      orderNumber,
      customerName: 'Test',
      promoCode: input.promoCode ?? null,
      discountTotal: String(input.discountTotal ?? 10),
      autoDiscountId: null,
      autoDiscountAmount: null,
      total: String(input.total ?? 100),
    }
  }

  const getPromo = async (id: number) => {
    const r = await pool.query(
      `SELECT used_count, total_orders_amount, total_discount_amount FROM promotions WHERE id = $1`,
      [id],
    )
    return {
      usedCount: Number(r.rows[0]?.used_count),
      totalOrdersAmount: Number(r.rows[0]?.total_orders_amount),
      totalDiscountAmount: Number(r.rows[0]?.total_discount_amount),
    }
  }

  const reservationRows = async (orderNumber: string) => {
    const r = await pool.query(
      `SELECT id, promotion_id, order_id, order_number, status, expires_at, created_at, consumed_at, released_at
         FROM promotion_reservations WHERE order_number = $1 ORDER BY id`,
      [orderNumber],
    )
    return r.rows
  }

  const ledgerCount = async (promoId: number, orderNumber: string) => {
    const r = await pool.query(
      `SELECT COUNT(*)::int AS c FROM promotion_usages WHERE promotion_id = $1 AND order_reference = $2`,
      [promoId, orderNumber],
    )
    return Number(r.rows[0]?.c)
  }

  beforeAll(async () => {
    pool = new PoolCtor!({ connectionString: TEST_DB_URL })
  })

  afterAll(async () => {
    if (!pool) return
    await pool.query(`DELETE FROM analytics_events WHERE order_id IN (SELECT id FROM orders WHERE order_number LIKE $1)`, [`${run}-%`])
    await pool.query(`DELETE FROM order_history WHERE order_id IN (SELECT id FROM orders WHERE order_number LIKE $1)`, [`${run}-%`])
    await pool.query(`DELETE FROM promotion_usages WHERE order_reference LIKE $1`, [`${run}-%`])
    await pool.query(`DELETE FROM promotion_reservations WHERE order_number LIKE $1`, [`${run}-%`])
    await pool.query(`DELETE FROM orders WHERE order_number LIKE $1`, [`${run}-%`])
    if (promoIds.length) {
      await pool.query(`DELETE FROM promotions WHERE id = ANY($1::int[])`, [promoIds])
    }
    await pool.end()
  })

  it('TTL is 45 minutes and the reservation holds the slot only (no amount columns)', async () => {
    const { PROMO_RESERVATION_TTL_MINUTES } = await import('@/lib/shop/promo-usage')
    expect(PROMO_RESERVATION_TTL_MINUTES).toBe(45)

    const cols = await pool.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'promotion_reservations' ORDER BY column_name`,
    )
    expect(cols.rows.map((r) => r.column_name)).toEqual([
      'consumed_at',
      'created_at',
      'expires_at',
      'id',
      'order_id',
      'order_number',
      'promotion_id',
      'released_at',
      'status',
    ])

    const idx = await pool.query(
      `SELECT indexname, indexdef FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'promotion_reservations'`,
    )
    const active = idx.rows.find((r) => r.indexname === 'promotion_reservations_active_order_idx')
    expect(active).toBeDefined()
    // Postgres normalizes the predicate (status::text = 'active'::text).
    expect(String(active?.indexdef)).toContain('WHERE')
    expect(String(active?.indexdef)).toContain("'active'")
    expect(idx.rows.some((r) => r.indexname === 'promotion_reservations_expires_idx')).toBe(true)

    // expires_at lands 45 minutes after creation.
    const promo = await makePromo(1)
    const order = await makeOrder({ promoCode: promo.code })
    const { reservePromoUsageForOrder } = await import('@/lib/shop/promo-usage')
    await reservePromoUsageForOrder(order)
    const [row] = await reservationRows(order.orderNumber)
    expect(row?.status).toBe('active')
    const ttlMs = new Date(String(row?.expires_at)).getTime() - new Date(String(row?.created_at)).getTime()
    expect(ttlMs).toBeGreaterThanOrEqual(45 * 60_000 - 120_000)
    expect(ttlMs).toBeLessThanOrEqual(45 * 60_000 + 120_000)
  })

  it('reservation consumes the last slot and a second order gets promo-limit at creation', async () => {
    const promo = await makePromo(1)
    const orderA = await makeOrder({ promoCode: promo.code })
    const orderB = await makeOrder({ promoCode: promo.code })
    const { reservePromoUsageForOrder } = await import('@/lib/shop/promo-usage')

    const first = await reservePromoUsageForOrder(orderA, undefined, { strict: true })
    expect(first.reserved).toEqual([promo.id])
    expect(await getPromo(promo.id)).toMatchObject({ usedCount: 1 })
    expect(await reservationRows(orderA.orderNumber)).toHaveLength(1)

    // Idempotent re-reserve: the same order must not take a second slot.
    const again = await reservePromoUsageForOrder(orderA, undefined, { strict: true })
    expect(again.reserved).toEqual([promo.id])
    expect(await getPromo(promo.id)).toMatchObject({ usedCount: 1 })
    expect(await reservationRows(orderA.orderNumber)).toHaveLength(1)

    await expect(
      reservePromoUsageForOrder(orderB, undefined, { strict: true }),
    ).rejects.toThrow('promo-limit')
    expect(await getPromo(promo.id)).toMatchObject({ usedCount: 1 })
    expect(await reservationRows(orderB.orderNumber)).toHaveLength(0)
  })

  it('finalize converts without double-counting usedCount', async () => {
    const promo = await makePromo(1)
    const order = await makeOrder({ promoCode: promo.code, discountTotal: 10, total: 100 })
    const { reservePromoUsageForOrder, recordPromoUsageForOrder } = await import('@/lib/shop/promo-usage')

    await reservePromoUsageForOrder(order)
    expect(await getPromo(promo.id)).toMatchObject({ usedCount: 1 })

    await recordPromoUsageForOrder(order)
    // Slot was already counted at reserve time: still 1, one ledger row,
    // totals from the ORDER amounts, reservation consumed.
    expect(await getPromo(promo.id)).toMatchObject({
      usedCount: 1,
      totalOrdersAmount: 100,
      totalDiscountAmount: 10,
    })
    expect(await ledgerCount(promo.id, order.orderNumber)).toBe(1)
    const [row] = await reservationRows(order.orderNumber)
    expect(row?.status).toBe('consumed')
    expect(row?.consumed_at).not.toBeNull()
  })

  it('cancel releases the slot for reuse (and release is idempotent)', async () => {
    const promo = await makePromo(1)
    const orderA = await makeOrder({ promoCode: promo.code })
    const orderB = await makeOrder({ promoCode: promo.code })
    const { reservePromoUsageForOrder, releasePromotionUsageForOrder } = await import('@/lib/shop/promo-usage')

    await reservePromoUsageForOrder(orderA)
    expect(await getPromo(promo.id)).toMatchObject({ usedCount: 1 })

    const { released } = await releasePromotionUsageForOrder(orderA.orderNumber)
    expect(released.map((r) => r.promotionId)).toEqual([promo.id])
    expect(await getPromo(promo.id)).toMatchObject({ usedCount: 0 })
    const [row] = await reservationRows(orderA.orderNumber)
    expect(row?.status).toBe('released')
    expect(row?.released_at).not.toBeNull()

    // Second release is a no-op.
    const second = await releasePromotionUsageForOrder(orderA.orderNumber)
    expect(second.released).toEqual([])
    expect(await getPromo(promo.id)).toMatchObject({ usedCount: 0 })

    // The freed slot is usable by the next order.
    const again = await reservePromoUsageForOrder(orderB, undefined, { strict: true })
    expect(again.reserved).toEqual([promo.id])
    expect(await getPromo(promo.id)).toMatchObject({ usedCount: 1 })
  })

  it('expired reservation is reaped lazily by the next claim', async () => {
    const promo = await makePromo(1)
    const orderA = await makeOrder({ promoCode: promo.code })
    const orderB = await makeOrder({ promoCode: promo.code })
    const { reservePromoUsageForOrder } = await import('@/lib/shop/promo-usage')

    await reservePromoUsageForOrder(orderA)
    expect(await getPromo(promo.id)).toMatchObject({ usedCount: 1 })
    await pool.query(
      `UPDATE promotion_reservations SET expires_at = NOW() - interval '1 hour' WHERE order_number = $1`,
      [orderA.orderNumber],
    )

    const result = await reservePromoUsageForOrder(orderB, undefined, { strict: true })
    expect(result.reserved).toEqual([promo.id])
    // Reap freed the dead hold (-1) and the new claim took it (+1): still 1.
    expect(await getPromo(promo.id)).toMatchObject({ usedCount: 1 })
    const [oldRow] = await reservationRows(orderA.orderNumber)
    expect(oldRow?.status).toBe('expired')
    const [newRow] = await reservationRows(orderB.orderNumber)
    expect(newRow?.status).toBe('active')
  })

  it('concurrent finalize (two calls, one order) records usage once', async () => {
    const promo = await makePromo(1)
    const order = await makeOrder({ promoCode: promo.code, discountTotal: 10, total: 100 })
    const { reservePromoUsageForOrder } = await import('@/lib/shop/promo-usage')
    const { finalizePaidOrder } = await import('@/lib/shop/order-fulfillment')

    await reservePromoUsageForOrder(order)

    const c1 = await pool.connect()
    const c2 = await pool.connect()
    try {
      await c1.query('BEGIN')
      await c2.query('BEGIN')
      // Each finalize commits its own client as soon as it resolves so the
      // loser's claim UPDATE (blocked on the row lock) can proceed.
      const p1 = finalizePaidOrder(order.orderNumber, c1).then(async (r) => {
        await c1.query('COMMIT')
        return r
      })
      const p2 = finalizePaidOrder(order.orderNumber, c2).then(async (r) => {
        await c2.query('COMMIT')
        return r
      })
      const [r1, r2] = await Promise.all([p1, p2])
      expect([r1, r2].filter((r) => r != null)).toHaveLength(1)
      expect(r1 ?? r2).toBe(order.orderId)
    } finally {
      await c1.query('ROLLBACK').catch(() => {})
      await c2.query('ROLLBACK').catch(() => {})
      c1.release()
      c2.release()
    }

    expect(await getPromo(promo.id)).toMatchObject({
      usedCount: 1,
      totalOrdersAmount: 100,
      totalDiscountAmount: 10,
    })
    expect(await ledgerCount(promo.id, order.orderNumber)).toBe(1)
    const [row] = await reservationRows(order.orderNumber)
    expect(row?.status).toBe('consumed')
  })

  it('unlimited promotions skip reservations; finalize still records usage', async () => {
    const promo = await makePromo(null)
    const order = await makeOrder({ promoCode: promo.code })
    const { reservePromoUsageForOrder, recordPromoUsageForOrder } = await import('@/lib/shop/promo-usage')

    const result = await reservePromoUsageForOrder(order)
    expect(result.reserved).toEqual([])
    expect(result.skippedUnlimited).toEqual([promo.id])
    expect(await reservationRows(order.orderNumber)).toHaveLength(0)
    expect(await getPromo(promo.id)).toMatchObject({ usedCount: 0 })

    await recordPromoUsageForOrder(order)
    expect(await getPromo(promo.id)).toMatchObject({
      usedCount: 1,
      totalOrdersAmount: 100,
      totalDiscountAmount: 10,
    })
    expect(await ledgerCount(promo.id, order.orderNumber)).toBe(1)
  })

  it('cash flow: reserve + consume in one transaction does not double-count', async () => {
    const promo = await makePromo(1)
    const order = await makeOrder({ promoCode: promo.code, discountTotal: 10, total: 100, status: 'new' })
    const { reservePromoUsageForOrder, recordPromoUsageForOrder } = await import('@/lib/shop/promo-usage')

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await reservePromoUsageForOrder(order, client, { strict: true })
      await recordPromoUsageForOrder(order, client, { strict: true })
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {})
      throw e
    } finally {
      client.release()
    }

    expect(await getPromo(promo.id)).toMatchObject({
      usedCount: 1,
      totalOrdersAmount: 100,
      totalDiscountAmount: 10,
    })
    expect(await ledgerCount(promo.id, order.orderNumber)).toBe(1)
  })

  it('full release after consume frees the slot and reverses totals', async () => {
    const promo = await makePromo(1)
    const order = await makeOrder({ promoCode: promo.code, discountTotal: 10, total: 100 })
    const { reservePromoUsageForOrder, recordPromoUsageForOrder, releasePromotionUsageForOrder } =
      await import('@/lib/shop/promo-usage')

    await reservePromoUsageForOrder(order)
    await recordPromoUsageForOrder(order)
    expect(await getPromo(promo.id)).toMatchObject({
      usedCount: 1,
      totalOrdersAmount: 100,
      totalDiscountAmount: 10,
    })

    const { released } = await releasePromotionUsageForOrder(order.orderNumber)
    expect(released.map((r) => r.promotionId)).toEqual([promo.id])
    expect(await getPromo(promo.id)).toMatchObject({
      usedCount: 0,
      totalOrdersAmount: 0,
      totalDiscountAmount: 0,
    })
    expect(await ledgerCount(promo.id, order.orderNumber)).toBe(0)
  })
})
