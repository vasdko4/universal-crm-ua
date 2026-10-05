import type { PoolClient } from 'pg'
import { pool } from '@/lib/db'

/**
 * One-shot storefront cleanup for a live DB that already mixed demo seed
 * with a Prom.ua import. Safe to run on every boot (idempotent).
 *
 * 1. Hide the six demo SKUs so they stop sitting next to imported cards.
 * 2. Move products off Prom's "Техніка та електроніка" root onto the
 *    seeded "Електроніка" category (same parent), then hide the duplicate.
 *
 * Runs under a Postgres advisory lock so concurrent cold starts (Vercel
 * spins up many instances at once) don't run it against each other, and
 * retries on deadlock (40P01) when it collides with live shop traffic.
 */
const DEMO_SKUS = ['IPH15P-128', 'CASE-15P-SIL', 'JBL-CH5', 'LOG-G502', 'KEY-K2', 'APP-2023-001']

// Stable two-part advisory-lock key for this job.
const HYGIENE_LOCK_KEY = [20261001, 7] as const
const MAX_ATTEMPTS = 3
const DEADLOCK_CODE = '40P01'

function isDeadlock(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === DEADLOCK_CODE
}

// Transient network-level failures from pg-pool's connect(): the pool could
// not open a fresh connection within connectionTimeoutMillis (10s default).
// Happens on cold-start connection storms (many Vercel instances booting at
// once under a traffic spike each run this hygiene in the background).
// Only these are retried — anything else (auth, config) fails fast.
const TRANSIENT_CONNECTION_CODES = new Set([
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
])

export function isTransientConnectionError(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null
  if (!e) return false
  if (
    typeof e.message === 'string' &&
    e.message.includes('Connection terminated due to connection timeout')
  ) {
    return true
  }
  return TRANSIENT_CONNECTION_CODES.has(e.code ?? '')
}

const CONNECT_MAX_ATTEMPTS = 3

export async function connectWithRetry(
  connect: () => Promise<PoolClient>,
  maxAttempts: number = CONNECT_MAX_ATTEMPTS,
): Promise<PoolClient> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await connect()
    } catch (err) {
      if (!isTransientConnectionError(err) || attempt >= maxAttempts) throw err
      await sleep(1000 * attempt)
    }
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

async function runOnce(client: Pick<PoolClient, 'query'>): Promise<void> {
  // Fresh / CI seeds only have the demo SKUs — leave them visible so e2e
  // and empty shops still have a catalog. Hide them once a Prom import exists.
  const { rows: imported } = await client.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM products WHERE deleted_at IS NULL AND prom_id IS NOT NULL`,
  )
  if (Number(imported[0]?.n ?? 0) > 0) {
    await client.query(
      `UPDATE products
       SET is_visible = false, updated_at = NOW()
       WHERE deleted_at IS NULL
         AND prom_id IS NULL
         AND sku = ANY($1::varchar[])
         AND is_visible IS DISTINCT FROM false`,
      [DEMO_SKUS],
    )
  }

  // Drop Prom.ua's doubled strike-through (exactly 2×) so the storefront
  // stops showing a fake −50% on almost every imported card.
  await client.query(`
    UPDATE products
    SET old_price = NULL, updated_at = NOW()
    WHERE deleted_at IS NULL
      AND prom_id IS NOT NULL
      AND old_price IS NOT NULL
      AND price > 0
      AND old_price / price BETWEEN 1.9 AND 2.1
  `)

  // Prom titles use both pipes and colons ("…, ціна 2125 ₴: купити на Prom.ua | Україна, Київ").
  await client.query(`
    UPDATE products
    SET
      meta_title_uk = NULLIF(trim(both FROM regexp_replace(
        regexp_replace(coalesce(meta_title_uk, ''),
          '[:|,·•]?\\s*(купити на )?Prom\\.ua\\b.*$', '', 'gi'),
        '[,:]?\\s*(ціна|цена)\\s+[\\d\\s.,]+[₴грн.]*\\s*$', '', 'gi')), ''),
      meta_title_ru = NULLIF(trim(both FROM regexp_replace(
        regexp_replace(coalesce(meta_title_ru, ''),
          '[:|,·•]?\\s*(купить на )?Prom\\.ua\\b.*$', '', 'gi'),
        '[,:]?\\s*(ціна|цена)\\s+[\\d\\s.,]+[₴грн.]*\\s*$', '', 'gi')), ''),
      meta_description_uk = NULLIF(trim(both FROM regexp_replace(coalesce(meta_description_uk, ''),
        '[:|,·•]?\\s*(купити на )?Prom\\.ua\\b.*$', '', 'gi')), ''),
      meta_description_ru = NULLIF(trim(both FROM regexp_replace(coalesce(meta_description_ru, ''),
        '[:|,·•]?\\s*(купить на )?Prom\\.ua\\b.*$', '', 'gi')), ''),
      updated_at = NOW()
    WHERE deleted_at IS NULL
      AND prom_id IS NOT NULL
      AND (
        coalesce(meta_title_uk, '') ~* 'prom\\.ua|купити на|україна,?\\s*київ'
        OR coalesce(meta_title_ru, '') ~* 'prom\\.ua|купить на|украина,?\\s*киев'
        OR coalesce(meta_description_uk, '') ~* 'prom\\.ua'
        OR coalesce(meta_description_ru, '') ~* 'prom\\.ua'
      )
  `)

  await client.query(`
    WITH alias_map AS (
      SELECT c.id AS from_id, t.id AS to_id
      FROM categories c
      JOIN categories t
        ON t.id <> c.id
       AND t.parent_id IS NOT DISTINCT FROM c.parent_id
       AND (
         (lower(trim(c.name_uk)) IN ('техніка та електроніка', 'техника и электроника')
          AND lower(trim(t.name_uk)) IN ('електроніка', 'электроника'))
         OR
         (lower(trim(coalesce(c.name_ru, ''))) IN ('техника и электроника', 'техніка та електроніка')
          AND lower(trim(coalesce(t.name_ru, t.name_uk))) IN ('электроника', 'електроніка'))
       )
    )
    INSERT INTO product_category (product_id, category_id)
    SELECT pc.product_id, m.to_id
    FROM product_category pc
    JOIN alias_map m ON m.from_id = pc.category_id
    WHERE NOT EXISTS (
      SELECT 1 FROM product_category x
      WHERE x.product_id = pc.product_id AND x.category_id = m.to_id
    )
  `)

  await client.query(`
    WITH alias_map AS (
      SELECT c.id AS from_id, t.id AS to_id
      FROM categories c
      JOIN categories t
        ON t.id <> c.id
       AND t.parent_id IS NOT DISTINCT FROM c.parent_id
       AND lower(trim(c.name_uk)) IN ('техніка та електроніка', 'техника и электроника')
       AND lower(trim(t.name_uk)) IN ('електроніка', 'электроника')
    )
    UPDATE categories AS child
    SET parent_id = m.to_id, updated_at = NOW()
    FROM alias_map m
    WHERE child.parent_id = m.from_id
  `)

  await client.query(`
    WITH alias_ids AS (
      SELECT c.id
      FROM categories c
      WHERE c.parent_id IS NULL
        AND lower(trim(c.name_uk)) IN ('техніка та електроніка', 'техника и электроника')
        AND EXISTS (
          SELECT 1 FROM categories t
          WHERE t.id <> c.id
            AND t.parent_id IS NULL
            AND lower(trim(t.name_uk)) IN ('електроніка', 'электроника')
        )
    )
    DELETE FROM product_category WHERE category_id IN (SELECT id FROM alias_ids)
  `)

  await client.query(`
    UPDATE categories c
    SET is_visible = false, updated_at = NOW()
    FROM categories t
    WHERE c.id <> t.id
      AND c.parent_id IS NULL AND t.parent_id IS NULL
      AND lower(trim(c.name_uk)) IN ('техніка та електроніка', 'техника и электроника')
      AND lower(trim(t.name_uk)) IN ('електроніка', 'электроника')
      AND c.is_visible IS DISTINCT FROM false
  `)

  // Seeded demo roots (accessories / audio / peripherals) stay empty after
  // Prom products land in "Електроніка". Hide them so the catalog chips
  // don't show 0-item categories. Leave them visible on a seed-only shop.
  if (Number(imported[0]?.n ?? 0) > 0) {
    await client.query(`
      UPDATE categories
      SET is_visible = false, updated_at = NOW()
      WHERE parent_id IS NULL
        AND slug IN ('accessories', 'audio', 'peripherals')
        AND is_visible IS DISTINCT FROM false
        AND NOT EXISTS (
          SELECT 1
          FROM product_category pc
          JOIN products p ON p.id = pc.product_id
          WHERE pc.category_id = categories.id
            AND p.deleted_at IS NULL
            AND p.is_visible IS DISTINCT FROM false
        )
    `)
  }
}

/**
 * Entry point used by `instrumentation.ts` on boot. Takes a session-level
 * advisory lock so only one instance runs the cleanup at a time; a second
 * concurrent cold start simply skips it. Deadlocks against live traffic are
 * retried with backoff — every statement above is idempotent.
 */
export async function runCatalogHygiene(): Promise<void> {
  // Bounded retry for transient connect storms only — the statements below
  // already retry on deadlock, and the advisory lock serializes instances.
  const client = await connectWithRetry(() => pool.connect())
  try {
    const { rows } = await client.query<{ ok: boolean }>(
      'SELECT pg_try_advisory_lock($1, $2) AS ok',
      [...HYGIENE_LOCK_KEY],
    )
    if (!rows[0]?.ok) return
    try {
      for (let attempt = 1; ; attempt++) {
        try {
          await runOnce(client)
          return
        } catch (err) {
          if (!isDeadlock(err) || attempt >= MAX_ATTEMPTS) throw err
          await sleep(250 * attempt)
        }
      }
    } finally {
      await client.query('SELECT pg_advisory_unlock($1, $2)', [...HYGIENE_LOCK_KEY])
    }
  } finally {
    client.release()
  }
}
