/**
 * One-off re-sync of the denormalized `products.orders_count` with real
 * orders (honest purchase counter, fix #1).
 *
 * The storefront display no longer reads this column at all — it derives
 * the count from real orders at read time (lib/shop/purchase-count.ts) — but
 * the stored value still feeds the `ordersCount + purchasesBoost` sort and
 * the admin product list, and years of cancelled test orders inflated it
 * (e.g. ACEFAST C16-03 showed "Купили 2 рази" from two cancelled test
 * orders). Run this once after the fix lands, and again any time the
 * stored values look stale; it is idempotent and safe to re-run.
 *
 * The "real order" predicate here MUST match financialOrdersWhere() in
 * lib/analytics/financial.ts — the single definition used by the read-time
 * derivation and every financial report (audit P1, 3.4.96):
 *   status NOT IN ('cancelled', 'pending_payment')
 *   AND payment_status <> 'refunded'
 * tests/purchase-count.test.ts guards the two texts against drift.
 *
 * Usage:
 *   node --env-file=.env.local scripts/recompute-orders-count.mjs [--dry-run] [--product-id=N]
 *
 *   --dry-run      show what would change without writing anything
 *   --product-id=N only recompute one product
 */
import { Pool } from 'pg'

// Same connection conventions as scripts/db-setup.mjs.
function trimQueryJunk(url) {
  let end = url.length
  while (end > 0 && (url[end - 1] === '?' || url[end - 1] === '&')) end -= 1
  return url.slice(0, end)
}

const rawConnectionString = process.env.DATABASE_URL
if (!rawConnectionString) {
  console.error('✗ DATABASE_URL is not set. Copy .env.example to .env.local first.')
  process.exit(1)
}
const requiresSsl =
  /[?&]sslmode=(require|verify-ca|verify-full)/.test(rawConnectionString) ||
  /\b(neon\.tech|supabase\.co|amazonaws\.com|render\.com|azure\.com|cockroachlabs\.cloud)\b/.test(
    rawConnectionString,
  )
const connectionString = trimQueryJunk(
  rawConnectionString
    .replace(/([?&])sslmode=[^&]*/gi, '$1')
    .replace(/([?&])channel_binding=[^&]*/gi, '$1')
    .replace(/\?&/g, '?')
    .replace(/&&+/g, '&'),
)

const pool = new Pool({
  connectionString,
  ssl: requiresSsl ? { rejectUnauthorized: false } : false, // nosemgrep: javascript.lang.security.audit.ssl-verify-disabled.bypass-tls-verification
})

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const productIdArg = args.find((a) => a.startsWith('--product-id='))
const productId = productIdArg ? Number(productIdArg.split('=')[1]) : null
if (productIdArg && (!Number.isInteger(productId) || productId <= 0)) {
  console.error('✗ --product-id must be a positive integer')
  process.exit(1)
}

// Real purchase count per product, as a correlated subquery — the same
// predicate as lib/shop/purchase-count.ts (COUNT DISTINCT order_id: one
// order with two lines of the same product is one purchase).
const realCountSql = (alias) => `(SELECT COUNT(DISTINCT oi.order_id)::int
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
   WHERE oi.product_id = ${alias}.id
     AND o.status NOT IN ('cancelled', 'pending_payment')
     AND o.payment_status <> 'refunded')`

const whereProduct = productId ? `WHERE p.id = $1` : ''
const params = productId ? [productId] : []

try {
  if (dryRun) {
    const { rows } = await pool.query(
      `SELECT p.id, p.slug, p.orders_count AS old_count, COALESCE(${realCountSql('p')}, 0) AS new_count
         FROM products p
         ${whereProduct}
        ORDER BY p.id`,
      params,
    )
    const changed = rows.filter((r) => Number(r.old_count ?? 0) !== Number(r.new_count))
    console.log(`[dry-run] ${rows.length} product(s) checked, ${changed.length} would change:`)
    for (const r of changed) {
      console.log(`  #${r.id} ${r.slug ?? ''}  ${r.old_count ?? 0} → ${r.new_count}`)
    }
    if (changed.length === 0) console.log('  (nothing to change — stored counts already match real orders)')
  } else {
    // One statement: recompute + report exactly the rows that changed, with
    // old and new values. IS DISTINCT FROM treats NULL stored counts as 0.
    const { rows } = await pool.query(
      `WITH before AS (SELECT id, orders_count FROM products ${productId ? 'WHERE id = $1' : ''}),
          updated AS (
            UPDATE products p
               SET orders_count = COALESCE(${realCountSql('p')}, 0)
              ${whereProduct}
            RETURNING p.id, p.orders_count
          )
       SELECT b.id, b.orders_count AS old_count, u.orders_count AS new_count
         FROM before b JOIN updated u ON u.id = b.id
        WHERE b.orders_count IS DISTINCT FROM u.orders_count
        ORDER BY b.id`,
      params,
    )
    const { rows: total } = await pool.query(
      `SELECT count(*)::int AS c FROM products ${productId ? 'WHERE id = $1' : ''}`,
      params,
    )
    console.log(`✓ recomputed ${total[0].c} product(s), ${rows.length} changed:`)
    for (const r of rows) {
      console.log(`  #${r.id}  ${r.old_count ?? 0} → ${r.new_count}`)
    }
    if (rows.length === 0) console.log('  (nothing changed — stored counts already matched real orders)')
  }
} catch (e) {
  console.error('✗ recompute failed:', e.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
