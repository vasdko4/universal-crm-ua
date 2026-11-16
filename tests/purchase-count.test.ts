import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = resolve(import.meta.dirname, '..')
// Structural tests compare source text with LF literals; normalize CRLF so
// they also pass on a Windows checkout (see the CRLF fix, 11.11.2026).
const source = (file: string) => readFileSync(resolve(root, file), 'utf8').replace(/\r\n/g, '\n')

describe('honest purchase counter (fix #1)', () => {
  it('storefront display derives from real orders, not the stored counter', () => {
    const queries = source('lib/shop/queries.ts')
    // The single choke point every storefront product read flows through.
    expect(queries).toContain('orders_count: realPurchaseCountSql()')
    expect(queries).not.toContain('orders_count: products.ordersCount')
    expect(queries).toContain("import { realPurchaseCountSql } from '@/lib/shop/purchase-count'")
  })

  it('sort still uses the stored counter + boost, unchanged', () => {
    const queries = source('lib/shop/queries.ts')
    const sortExpr = 'desc(sql`${products.ordersCount} + ${products.purchasesBoost}`)'
    // Catalog "popular" sort AND the popular-products rail.
    expect(queries.split(sortExpr).length - 1).toBe(2)
  })

  it('the boost is never added to the displayed count', () => {
    const helper = source('lib/shop/purchase-count.ts')
    // The SQL the storefront actually runs must not reference the boost.
    const fn = helper.slice(helper.indexOf('export function realPurchaseCountSql'))
    expect(fn).not.toContain('purchasesBoost')
    expect(fn).not.toContain('purchases_boost')
    const form = source('components/products/product-form.tsx')
    // The form preview still shows real + boost as the *sort* signal only.
    expect(form).toContain('form.realOrdersCount + Math.max(0, Math.trunc(Number(form.purchasesBoost) || 0))')
  })

  it('the recompute script uses the same real-order predicate as the app', () => {
    // financialOrdersWhere('o') is the single definition of a real sale
    // (audit P1, 3.4.96); the .mjs script cannot import it, so guard the
    // duplicated text against drift here.
    const script = source('scripts/recompute-orders-count.mjs')
    expect(script).toContain("o.status NOT IN ('cancelled', 'pending_payment')")
    expect(script).toContain("o.payment_status <> 'refunded'")
    expect(source('lib/analytics/financial.ts')).toContain(
      "return `${orderAlias}.status NOT IN ('cancelled', 'pending_payment') AND ${orderAlias}.payment_status <> 'refunded'`",
    )
  })

  it('admin edit page reads the derived count, not the stored column', () => {
    const page = source('app/admin/products/[id]/edit/page.tsx')
    expect(page).toContain('getRealOrdersCount(productId)')
    expect(page).not.toContain('realOrdersCount: product.ordersCount')
  })
})

// Live test: needs a reachable Postgres. Run locally with e.g.
//   TEST_DATABASE_URL=postgresql://techno:techno_e2e_local@localhost:5432/techno_counter pnpm test tests/purchase-count.test.ts
// (or leave TEST_DATABASE_URL unset and have DATABASE_URL point at a scratch
// database). The test only ever touches rows it creates itself (slug prefix
// `test-purchase-count-`) and deletes them afterwards — CI has no Postgres
// service, so it skips there.
const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? ''

let PoolCtor: (new (opts: { connectionString: string; connectionTimeoutMillis?: number }) => {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>
  end: () => Promise<void>
}) | null = null
let dbAvailable = false
try {
  const pg = await import('pg')
  PoolCtor = pg.Pool
  const probe = new pg.Pool({ connectionString: TEST_DB_URL, connectionTimeoutMillis: 2000 })
  await probe.query('SELECT 1')
  await probe.end()
  dbAvailable = true
} catch {
  dbAvailable = false
}
const describeDb = dbAvailable ? describe : describe.skip

describeDb('honest purchase counter (fix #1): live', () => {
  const slug = `test-purchase-count-${Date.now()}`
  let pool: {
    query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>
    end: () => Promise<void>
  }
  let productId = 0
  const orderIds: number[] = []

  beforeAll(async () => {
    pool = new PoolCtor!({ connectionString: TEST_DB_URL })
    // Simulate the ACEFAST case: stored counter inflated to 99 by cancelled
    // test orders.
    const p = await pool.query(
      `INSERT INTO products (name_uk, slug, price, quantity, is_visible, orders_count)
       VALUES ('Test Purchase Count', $1, 100, 10, true, 99) RETURNING id`,
      [slug],
    )
    productId = Number(p.rows[0]?.id)
    const addOrder = async (status: string, paymentStatus: string, lines: number) => {
      const o = await pool.query(
        `INSERT INTO orders (order_number, status, payment_status, total)
         VALUES ($1, $2, $3, 100) RETURNING id`,
        [`TEST-PC-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, status, paymentStatus],
      )
      const id = Number(o.rows[0]?.id)
      orderIds.push(id)
      for (let i = 0; i < lines; i++) {
        await pool.query(
          `INSERT INTO order_items (order_id, product_id, name, price, quantity, total)
           VALUES ($1, $2, 'Test Purchase Count', 100, 1, 100)`,
          [id, productId],
        )
      }
      return id
    }
    await addOrder('new', 'paid', 2) // real order, TWO lines of the product = ONE purchase
    await addOrder('cancelled', 'unpaid', 1) // cancelled test order — must not count
    await addOrder('pending_payment', 'unpaid', 1) // abandoned checkout — must not count
    await addOrder('done', 'refunded', 1) // fully refunded — must not count
    await addOrder('new', 'unpaid', 1) // cash on delivery, real order — counts
  })

  afterAll(async () => {
    await pool.query(`DELETE FROM order_items WHERE product_id = $1`, [productId])
    await pool.query(`DELETE FROM orders WHERE id = ANY($1::int[])`, [orderIds])
    await pool.query(`DELETE FROM products WHERE id = $1`, [productId])
    await pool.end()
  })

  it('getRealOrdersCount counts only real orders (2), not lines or dead orders', async () => {
    const { getRealOrdersCount } = await import('@/lib/shop/purchase-count')
    expect(await getRealOrdersCount(productId)).toBe(2)
  })

  it('the storefront select fragment returns the same derived count', async () => {
    const { db } = await import('@/lib/db')
    const { products } = await import('@/lib/db/schema')
    const { realPurchaseCountSql } = await import('@/lib/shop/purchase-count')
    const { eq } = await import('drizzle-orm')
    const rows = await db
      .select({ c: realPurchaseCountSql() })
      .from(products)
      .where(eq(products.id, productId))
    expect(Number(rows[0]?.c)).toBe(2)
  })

  it('the recompute script fixes the stored counter (99 → 2)', async () => {
    const before = await pool.query(`SELECT orders_count FROM products WHERE id = $1`, [productId])
    expect(Number(before.rows[0]?.orders_count)).toBe(99)
    const { stdout } = await execFileAsync('node', ['scripts/recompute-orders-count.mjs', `--product-id=${productId}`], {
      cwd: root,
      env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    })
    expect(stdout).toContain('99 → 2')
    const after = await pool.query(`SELECT orders_count FROM products WHERE id = $1`, [productId])
    expect(Number(after.rows[0]?.orders_count)).toBe(2)
    // Idempotent: a second run changes nothing.
    const again = await execFileAsync('node', ['scripts/recompute-orders-count.mjs', `--product-id=${productId}`], {
      cwd: root,
      env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    })
    expect(again.stdout).toContain('0 changed')
  })
})
