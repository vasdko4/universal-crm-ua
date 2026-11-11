import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
// Structural tests compare source text with LF literals; normalize CRLF so
// they also pass on a Windows checkout (see the CRLF fix, 11.11.2026).
const source = (file: string) => readFileSync(resolve(root, file), 'utf8').replace(/\r\n/g, '\n')

describe('audit P2 (3.4.96): stock ledger lock-then-update', () => {
  const products = source('app/actions/products.ts')

  it('updateProductStock locks the row before the UPDATE (no target CTE)', () => {
    const fn = products.slice(products.indexOf('export async function updateProductStock'))
    const lockAt = fn.indexOf('SELECT id, quantity FROM products WHERE id = $1 FOR UPDATE')
    expect(lockAt).toBeGreaterThan(-1)
    const updateAt = fn.indexOf('UPDATE products p SET')
    expect(updateAt).toBeGreaterThan(lockAt)
    expect(fn).not.toContain('WITH target AS')
    expect(fn).toContain('const actualDelta = Number(row.qty_after) - qtyBefore')
  })

  it('bulkAdjustProductStock locks the set in deterministic order', () => {
    const fn = products.slice(products.indexOf('export async function bulkAdjustProductStock'))
    expect(fn).toContain(
      'SELECT id, quantity FROM products WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE',
    )
    expect(fn).toContain('const actualDelta = Number(row.qty_after) - qtyBefore')
    expect(fn).not.toContain('WITH target AS')
  })

  it('no target CTE remains anywhere in products.ts', () => {
    expect(products).not.toContain('WITH target AS')
    expect(products).not.toContain('SELECT id, quantity AS qty_before')
  })
})

// Live concurrency tests need a reachable Postgres. Run locally with e.g.
//   TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres pnpm test tests/stock-ledger-race.test.ts
// (or leave TEST_DATABASE_URL unset and have postgres on localhost:5432
// with user `postgres` / password `postgres`). The tests only ever touch
// tables named stock_race_* in that database, and skip when no server
// answers — CI has no Postgres service, so they skip there.
const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/postgres'

type TestClient = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>
  release: () => void
}
type TestPool = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>
  connect: () => Promise<TestClient>
  end: () => Promise<void>
}

let PoolCtor: (new (opts: { connectionString: string; connectionTimeoutMillis?: number }) => TestPool) | null = null
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

const PRODUCTS = 'stock_race_products'
const MOVEMENTS = 'stock_race_movements'

describeDb('audit P2 (3.4.96): live two-connection race', () => {
  let pool: TestPool

  // The FIXED lock-then-update sequences from updateProductStock /
  // bulkAdjustProductStock (same statements, same order), run against the
  // test tables. The production functions are server actions (they need an
  // admin session), so the live test replicates their SQL; the structural
  // tests above tie the production code to exactly these statements.
  async function adjustRelativeNew(client: TestClient, id: number, d: number): Promise<number> {
    const locked = await client.query(
      `SELECT id, quantity FROM ${PRODUCTS} WHERE id = $1 FOR UPDATE`,
      [id],
    )
    const qtyBefore = Number(locked.rows[0].quantity)
    const { rows } = await client.query(
      `UPDATE ${PRODUCTS} SET quantity = GREATEST(0, quantity + $1), updated_at = NOW()
       WHERE id = $2 RETURNING id, quantity AS qty_after`,
      [d, id],
    )
    const qtyAfter = Number(rows[0].qty_after)
    const delta = qtyAfter - qtyBefore
    await client.query(
      `INSERT INTO ${MOVEMENTS} (product_id, delta, quantity_after, reason) VALUES ($1, $2, $3, 'bulk')`,
      [id, delta, qtyAfter],
    )
    return delta
  }

  async function setAbsoluteNew(client: TestClient, id: number, qty: number): Promise<number> {
    const locked = await client.query(
      `SELECT id, quantity FROM ${PRODUCTS} WHERE id = $1 FOR UPDATE`,
      [id],
    )
    const qtyBefore = Number(locked.rows[0].quantity)
    const { rows } = await client.query(
      `UPDATE ${PRODUCTS} SET quantity = $2, updated_at = NOW()
       WHERE id = $1 RETURNING id, quantity AS qty_after`,
      [id, qty],
    )
    const qtyAfter = Number(rows[0].qty_after)
    const delta = qtyAfter - qtyBefore
    if (delta !== 0) {
      await client.query(
        `INSERT INTO ${MOVEMENTS} (product_id, delta, quantity_after, reason) VALUES ($1, $2, $3, 'adjust')`,
        [id, delta, qtyAfter],
      )
    }
    return delta
  }

  // The OLD single-statement CTE sequence (pre-3.4.96). Kept only to prove
  // the harness reproduces the race: if this ever stops returning the
  // inflated delta, the test setup is broken (or Postgres changed
  // EvalPlanQual semantics) and the "fixed" assertions become vacuous.
  async function adjustRelativeOld(client: TestClient, id: number, d: number): Promise<number> {
    const { rows } = await client.query(
      `WITH target AS (
         SELECT id, quantity AS qty_before FROM ${PRODUCTS} WHERE id = $1
       ),
       upd AS (
         UPDATE ${PRODUCTS} SET quantity = GREATEST(0, quantity + $2), updated_at = NOW()
         WHERE id = $1
         RETURNING id, quantity AS qty_after
       )
       SELECT upd.id, upd.qty_after, target.qty_before
       FROM upd JOIN target ON target.id = upd.id`,
      [id, d],
    )
    const row = rows[0]
    const delta = Number(row.qty_after) - Number(row.qty_before)
    await client.query(
      `INSERT INTO ${MOVEMENTS} (product_id, delta, quantity_after, reason) VALUES ($1, $2, $3, 'bulk')`,
      [id, delta, Number(row.qty_after)],
    )
    return delta
  }

  // Session A holds the row lock with an uncommitted update; session B runs
  // `run` (which must block on the lock), then A commits and B finishes.
  async function raceAgainstUncommittedUpdate(run: (client: TestClient) => Promise<number>): Promise<number> {
    const a = await pool.connect()
    const b = await pool.connect()
    try {
      await a.query('BEGIN')
      await a.query(`UPDATE ${PRODUCTS} SET quantity = 15, updated_at = NOW() WHERE id = 1`)
      await b.query('BEGIN')
      const pending = run(b)
      // Give B time to reach the lock and block; then release it.
      await new Promise((r) => setTimeout(r, 300))
      await a.query('COMMIT')
      const delta = await Promise.race([
        pending,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('adjust timed out waiting for the row lock')), 10_000),
        ),
      ])
      await b.query('COMMIT')
      return delta
    } finally {
      try {
        await a.query('ROLLBACK')
      } catch {
        /* already committed */
      }
      try {
        await b.query('ROLLBACK')
      } catch {
        /* already committed */
      }
      a.release()
      b.release()
    }
  }

  async function resetProduct(qty: number) {
    await pool.query(`DELETE FROM ${MOVEMENTS}`)
    await pool.query(`DELETE FROM ${PRODUCTS}`)
    await pool.query(`INSERT INTO ${PRODUCTS} (id, quantity) VALUES (1, $1)`, [qty])
  }

  async function recordedDelta(): Promise<number> {
    const { rows } = await pool.query(
      `SELECT delta FROM ${MOVEMENTS} WHERE product_id = 1 ORDER BY id DESC LIMIT 1`,
    )
    return Number(rows[0]?.delta)
  }

  async function finalQuantity(): Promise<number> {
    const { rows } = await pool.query(`SELECT quantity FROM ${PRODUCTS} WHERE id = 1`)
    return Number(rows[0]?.quantity)
  }

  beforeAll(async () => {
    pool = new PoolCtor!({ connectionString: TEST_DB_URL })
    await pool.query(
      `CREATE TABLE IF NOT EXISTS ${PRODUCTS} (id SERIAL PRIMARY KEY, quantity INT NOT NULL DEFAULT 0, is_in_stock BOOLEAN DEFAULT true, stock_status TEXT DEFAULT 'В наявності', updated_at TIMESTAMPTZ DEFAULT now())`,
    )
    await pool.query(
      `CREATE TABLE IF NOT EXISTS ${MOVEMENTS} (id SERIAL PRIMARY KEY, product_id INT NOT NULL, variant_id INT, delta INT NOT NULL, quantity_after INT, reason VARCHAR(40) NOT NULL, order_id INT, actor VARCHAR(255), note TEXT, created_at TIMESTAMPTZ DEFAULT now())`,
    )
  })

  afterAll(async () => {
    await pool.query(`DROP TABLE IF EXISTS ${MOVEMENTS}, ${PRODUCTS}`)
    await pool.end()
  })

  beforeEach(async () => {
    await resetProduct(10)
  })

  it('relative adjust: concurrent +5 records delta +5 (not +10)', async () => {
    const delta = await raceAgainstUncommittedUpdate((b) => adjustRelativeNew(b, 1, 5))
    expect(delta).toBe(5)
    expect(await finalQuantity()).toBe(20)
    expect(await recordedDelta()).toBe(5)
  }, 15_000)

  it('absolute set: concurrent set-to-20 records delta +5 (not +10)', async () => {
    const delta = await raceAgainstUncommittedUpdate((b) => setAbsoluteNew(b, 1, 20))
    expect(delta).toBe(5)
    expect(await finalQuantity()).toBe(20)
    expect(await recordedDelta()).toBe(5)
  }, 15_000)

  it('old CTE pattern records +10 for the same interleaving (proves the race is real)', async () => {
    const delta = await raceAgainstUncommittedUpdate((b) => adjustRelativeOld(b, 1, 5))
    expect(delta).toBe(10)
    expect(await finalQuantity()).toBe(20)
    expect(await recordedDelta()).toBe(10)
  }, 15_000)
})
