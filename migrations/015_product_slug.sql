-- ---------- Товары: человекочитаемые URL (slug) ----------
-- Раньше страница товара была только `/product/<numeric id>` — нечитаемо,
-- не даёт SEO-сигнала и одинаково выглядит в рекламе/письмах для любого
-- товара. Добавляем `slug` (транслитерация названия латиницей, тот же
-- алфавит, что lib/slug.ts), используемый теперь во всех ссылках на товар
-- (карточки, письма, sitemap, Google Merchant feed, JSON-LD). Числовой
-- `/product/<id>` продолжает работать и делает 301-редирект на новый
-- `/product/<slug>` — старые закладки/индексация не ломаются.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "slug" varchar(255);

WITH base AS (
  SELECT
    id,
    substring(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            translate(
              replace(replace(replace(replace(replace(replace(replace(replace(replace(
                lower(coalesce(nullif(name_uk, ''), nullif(name_ru, ''), '')),
                'є','ie'),'ж','zh'),'х','kh'),'ц','ts'),'ч','ch'),'щ','shch'),'ш','sh'),'ю','iu'),'я','ia'),
              'абвгґдезиіїйклмнопрстуфыэёьъ',
              'abvggdezyiiiklmnoprstufyee'
            ),
            '[^a-z0-9]+', '-', 'g'
          ),
          '^-+', ''
        ),
        '-+$', ''
      )
      from 1 for 200
    ) AS raw_slug
  FROM products
  WHERE slug IS NULL
),
ranked AS (
  SELECT
    id,
    CASE WHEN raw_slug IS NULL OR raw_slug = '' THEN 'product-' || id ELSE raw_slug END AS candidate,
    row_number() OVER (
      PARTITION BY (CASE WHEN raw_slug IS NULL OR raw_slug = '' THEN 'product-' || id ELSE raw_slug END)
      ORDER BY id
    ) AS rn
  FROM base
)
UPDATE products p
SET slug = CASE WHEN r.rn = 1 THEN r.candidate ELSE r.candidate || '-' || r.id END
FROM ranked r
WHERE r.id = p.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON "products" ("slug");
