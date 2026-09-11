import 'server-only'
import { pool } from '@/lib/db'
import { revalidateStorefront } from '@/lib/shop/cache'

/**
 * Older Prom.ua imports stored the size axis on `options`, characteristics,
 * or variant keys, but left `products.sizes` empty. Listing cards only look
 * at `sizes`, so «Обрати розмір» stayed hidden until a re-import.
 *
 * Production (Vercel) does not run migrate.sql on deploy, so this also runs
 * once per server instance on the first storefront request.
 */
const BACKFILL_SQL = `
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sizes" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "options" jsonb DEFAULT '[]'::jsonb;
CREATE TABLE IF NOT EXISTS "product_characteristics" (
  "id" serial NOT NULL,
  "product_id" integer NOT NULL,
  "name" varchar(255) NOT NULL,
  "value" text NOT NULL,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "product_variants" (
  "id" serial NOT NULL,
  "product_id" integer NOT NULL,
  "options" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "sku" varchar(100),
  "price" numeric(10,2) DEFAULT 0 NOT NULL,
  "old_price" numeric(10,2),
  "quantity" integer DEFAULT 0 NOT NULL,
  "image" varchar(500),
  "is_in_stock" boolean DEFAULT true,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

UPDATE products p
SET sizes = sub.sizes
FROM (
  SELECT
    id,
    COALESCE((
      SELECT jsonb_agg(val)
      FROM jsonb_array_elements(COALESCE(options, '[]'::jsonb)) AS opt,
           jsonb_array_elements_text(COALESCE(opt->'values', '[]'::jsonb)) AS val
      WHERE lower(opt->>'name') ~ 'розмір|размер|size'
        AND val <> ''
        AND val !~* 'маломір'
    ), '[]'::jsonb) AS sizes
  FROM products
  WHERE deleted_at IS NULL
) sub
WHERE p.id = sub.id
  AND jsonb_array_length(sub.sizes) > 0
  AND (p.sizes IS NULL OR p.sizes = '[]'::jsonb);

UPDATE products p
SET sizes = sub.sizes
FROM (
  SELECT product_id, jsonb_agg(DISTINCT trimmed) AS sizes
  FROM (
    SELECT pc.product_id, trim(val) AS trimmed
    FROM product_characteristics pc,
         LATERAL unnest(regexp_split_to_array(pc.value, '[,;/|]+')) AS val
    WHERE lower(pc.name) ~ 'розмір|размер|size'
      AND trim(val) <> ''
      AND trim(val) !~* 'маломір'
  ) chars
  GROUP BY product_id
) sub
WHERE p.id = sub.product_id
  AND jsonb_array_length(sub.sizes) > 0
  AND (p.sizes IS NULL OR p.sizes = '[]'::jsonb);

UPDATE products p
SET sizes = sub.sizes
FROM (
  SELECT product_id, jsonb_agg(DISTINCT vsize) AS sizes
  FROM (
    SELECT v.product_id, v.options ->> k AS vsize
    FROM product_variants v,
         LATERAL jsonb_object_keys(COALESCE(v.options, '{}'::jsonb)) k
    WHERE lower(k) ~ 'розмір|размер|size'
      AND COALESCE(v.options ->> k, '') <> ''
      AND COALESCE(v.options ->> k, '') !~* 'маломір'
  ) vs
  WHERE vsize <> ''
  GROUP BY product_id
) sub
WHERE p.id = sub.product_id
  AND jsonb_array_length(sub.sizes) > 0
  AND (p.sizes IS NULL OR p.sizes = '[]'::jsonb);
`

let pending: Promise<void> | null = null

async function run(): Promise<void> {
  try {
    const result = await pool.query(BACKFILL_SQL)
    const updated = Array.isArray(result)
      ? result.reduce((n, r) => n + (r.rowCount ?? 0), 0)
      : (result.rowCount ?? 0)
    if (updated > 0) revalidateStorefront()
  } catch (err) {
    console.error('[backfill-product-sizes]', err instanceof Error ? err.message : err)
  }
}

export function ensureProductSizesBackfill(): Promise<void> {
  if (!pending) pending = run()
  return pending
}
