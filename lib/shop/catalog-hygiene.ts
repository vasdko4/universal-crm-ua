import { pool } from '@/lib/db'

/**
 * One-shot storefront cleanup for a live DB that already mixed demo seed
 * with a Prom.ua import. Safe to run on every boot (idempotent).
 *
 * 1. Hide the six demo SKUs so they stop sitting next to imported cards.
 * 2. Move products off Prom's "Техніка та електроніка" root onto the
 *    seeded "Електроніка" category (same parent), then hide the duplicate.
 */
const DEMO_SKUS = ['IPH15P-128', 'CASE-15P-SIL', 'JBL-CH5', 'LOG-G502', 'KEY-K2', 'APP-2023-001']

export async function runCatalogHygiene(): Promise<void> {
  // Fresh / CI seeds only have the demo SKUs — leave them visible so e2e
  // and empty shops still have a catalog. Hide them once a Prom import exists.
  const { rows: imported } = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM products WHERE deleted_at IS NULL AND prom_id IS NOT NULL`,
  )
  if (Number(imported[0]?.n ?? 0) > 0) {
    await pool.query(
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
  await pool.query(`
    UPDATE products
    SET old_price = NULL, updated_at = NOW()
    WHERE deleted_at IS NULL
      AND prom_id IS NOT NULL
      AND old_price IS NOT NULL
      AND price > 0
      AND old_price / price BETWEEN 1.9 AND 2.1
  `)

  await pool.query(`
    UPDATE products
    SET
      meta_title_uk = NULLIF(trim(both FROM regexp_replace(regexp_replace(coalesce(meta_title_uk, ''),
        '\\s*[|·•]?\\s*(купити на )?Prom\\.ua\\b.*$', '', 'gi'),
        '\\s*[|·•]\\s*Україна,?\\s*Київ\\b.*$', '', 'gi')), ''),
      meta_title_ru = NULLIF(trim(both FROM regexp_replace(regexp_replace(coalesce(meta_title_ru, ''),
        '\\s*[|·•]?\\s*(купить на )?Prom\\.ua\\b.*$', '', 'gi'),
        '\\s*[|·•]\\s*Украина,?\\s*Киев\\b.*$', '', 'gi')), ''),
      updated_at = NOW()
    WHERE deleted_at IS NULL
      AND prom_id IS NOT NULL
      AND (
        coalesce(meta_title_uk, '') ~* 'prom\\.ua|україна,?\\s*київ'
        OR coalesce(meta_title_ru, '') ~* 'prom\\.ua|украина,?\\s*киев'
      )
  `)

  await pool.query(`
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

  await pool.query(`
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

  await pool.query(`
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

  await pool.query(`
    UPDATE categories c
    SET is_visible = false, updated_at = NOW()
    FROM categories t
    WHERE c.id <> t.id
      AND c.parent_id IS NULL AND t.parent_id IS NULL
      AND lower(trim(c.name_uk)) IN ('техніка та електроніка', 'техника и электроника')
      AND lower(trim(t.name_uk)) IN ('електроніка', 'электроника')
      AND c.is_visible IS DISTINCT FROM false
  `)
}
