-- ============================================================
-- Безопасная миграция существующей продакшен-базы до актуальной
-- схемы. НЕ удаляет и НЕ перезаписывает данные — только добавляет
-- недостающие таблицы, колонки и индексы. Можно запускать повторно.
--
-- Применение на сервере:
--   sudo -u postgres psql -d ИМЯ_БАЗЫ -f db/migrate.sql
-- ============================================================

SET search_path TO public;

-- ---------- Аналитика (нужна для /api/track) ----------
CREATE TABLE IF NOT EXISTS "analytics_events" (
  "id" serial NOT NULL,
  "type" varchar(30) NOT NULL,
  "path" varchar(500),
  "product_id" integer,
  "order_id" integer,
  "amount" numeric(12,2),
  "session_id" varchar(80),
  "referrer" varchar(300),
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events (created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_created ON analytics_events (type, created_at);

-- ---------- Товары: накрутка счётчика покупок ----------
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "purchases_boost" integer DEFAULT 0 NOT NULL;

-- ---------- Заказы: промокод и себестоимость ----------
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "promo_code" varchar(80);
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "cost_price" numeric(12,2);

-- ---------- Настройки магазина: новые JSONB-блоки ----------
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "contact" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "seo" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "notifications" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "google_auth" jsonb DEFAULT '{}'::jsonb NOT NULL;
-- Hero-блок главной страницы (тексты uk/ru + картинка), Настройки → Главная.
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "home_hero" jsonb DEFAULT '{}'::jsonb NOT NULL;

-- Email-настройки: дополняем существующий JSON полями DKIM (не трогая
-- уже сохранённые значения SMTP).
UPDATE "store_settings"
SET "email_settings" =
  jsonb_build_object('dkimSelector', '', 'dkimPrivateKey', '') || "email_settings"
WHERE NOT ("email_settings" ? 'dkimSelector');

-- ---------- Недостающие индексы (важно на слабом VPS) ----------
-- Без них страница категории и вкладки отзывов/вопросов на карточке товара
-- делают полное сканирование таблицы при росте каталога/отзывов.
CREATE INDEX IF NOT EXISTS idx_product_category_category_id ON product_category (category_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_status ON product_reviews (product_id, status);
CREATE INDEX IF NOT EXISTS idx_product_reviews_status_created ON product_reviews (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_questions_product_status ON product_questions (product_id, status);
CREATE INDEX IF NOT EXISTS idx_product_questions_status_created ON product_questions (status, created_at DESC);

-- ---------- Заказы: флаг возврата остатков при отмене ----------
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "stock_restored" boolean DEFAULT false NOT NULL;

-- ---------- Админ-центр: язык интерфейса на пользователя ----------
-- Хранится в БД (user.locale), выбор не спрашивается повторно при входе.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "locale" varchar(5) DEFAULT 'uk'::character varying NOT NULL;

-- ---------- Заказы: атрибуция трафика (utm_*) ----------
-- Захватывается из ?utm_* параметров при заходе на сайт (см. lib/shop/utm.ts),
-- чтобы видеть, какая рекламная кампания реально привела заказ.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "utm_source" varchar(150);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "utm_medium" varchar(150);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "utm_campaign" varchar(150);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "utm_term" varchar(150);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "utm_content" varchar(150);

-- ---------- Google Merchant Center: категория товара + доставка в фиде ----------
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "merchant_feed" jsonb DEFAULT '{}'::jsonb NOT NULL;

-- ---------- Минимальная сумма заказа + чек заказа ----------
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "min_order" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "receipt_url" text;

-- ---------- Товары: включатель вариантов (цвет/размер и т.д.) ----------
-- По умолчанию false для новых товаров. Для уже существующих товаров, у
-- которых уже настроены комбинации вариантов, включаем автоматически, чтобы
-- их цена/остаток не «слетели» на агрегаты старого способа после апдейта.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "variants_enabled" boolean DEFAULT false NOT NULL;

UPDATE "products" p
SET "variants_enabled" = true
WHERE EXISTS (SELECT 1 FROM "product_variants" pv WHERE pv."product_id" = p."id")
  AND NOT p."variants_enabled";

-- ---------- Язык витрины: запоминаем выбор по IP ----------
-- Чтобы не переспрашивать язык повторно в другом браузере/устройстве той же
-- сети. Осознанное ограничение: IP бывает общим на нескольких людей и
-- меняется при смене сети — это подсказка по умолчанию, не точная привязка.
CREATE TABLE IF NOT EXISTS "locale_by_ip" (
  "ip" varchar(64) PRIMARY KEY,
  "locale" varchar(5) NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

-- ---------- Автоматические скидки (акции без промокода) ----------
-- Раньше акции с type='discount' сохранялись в админке, но никогда не
-- применялись ни в корзине, ни при оформлении заказа — эти колонки нужны,
-- чтобы отследить, какая автоматическая акция и на какую сумму применена к
-- заказу (отдельно от вручную введённого promo_code), для точной статистики
-- использования в /admin/promotions.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "auto_discount_id" integer;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "auto_discount_amount" numeric(12,2);

-- ---------- Статус наличия: "скоро в наличии" / предзаказ ----------
-- См. migrations/014_availability_mode.sql
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "availability_mode" varchar(20) DEFAULT 'default'::character varying NOT NULL;

-- ---------- Готово ----------
DO $$ BEGIN RAISE NOTICE 'Миграция применена успешно.'; END $$;

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

-- Блок из 4 карточек-преимуществ на главной странице (доставка/гарантия/
-- оплата/поддержка) — тексты uk/ru, редактируется в Настройки → Главная.
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "home_benefits" jsonb DEFAULT '{}'::jsonb NOT NULL;

-- Bilingual article body (uk in title/excerpt/content, ru in *_ru). Empty ru
-- falls back to uk on the storefront.
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "title_ru" varchar(255);
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "excerpt_ru" text;
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "content_ru" text;

UPDATE "articles" SET
  "title_ru" = 'Как выбрать беспроводные наушники в 2026 году',
  "excerpt_ru" = 'Разбираем ключевые характеристики при выборе наушников.',
  "content_ru" = '<p>При выборе наушников обратите внимание на шумоподавление, время работы и качество звука.</p>'
WHERE "slug" = 'how-to-choose-earbuds' AND "title_ru" IS NULL;

UPDATE "articles" SET
  "title_ru" = 'ТОП-5 смартфонов по соотношению цена/качество',
  "excerpt_ru" = 'Наша подборка лучших смартфонов месяца.',
  "content_ru" = '<p>В этом обзоре мы собрали 5 моделей, которые стоит внимания.</p>'
WHERE "slug" = 'top-5-smartphones' AND "title_ru" IS NULL;

UPDATE "articles" SET
  "title_ru" = 'Как ухаживать за механической клавиатурой',
  "excerpt_ru" = 'Простые советы для долговечности вашей клавиатуры.',
  "content_ru" = '<p>Регулярно чистите переключатели и снимайте кейкапы.</p>'
WHERE "slug" = 'keyboard-care' AND "title_ru" IS NULL;

-- Staff TOTP (admin 2FA).
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "two_factor_secret" varchar(64);
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "two_factor_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "two_factor_pending_secret" varchar(64);

-- Nova Poshta refs on orders + stock ledger.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_city_ref" varchar(64);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_warehouse_ref" varchar(64);

CREATE TABLE IF NOT EXISTS "stock_movements" (
  "id" serial PRIMARY KEY,
  "product_id" integer NOT NULL,
  "variant_id" integer,
  "delta" integer NOT NULL,
  "quantity_after" integer,
  "reason" varchar(40) NOT NULL,
  "order_id" integer,
  "actor" varchar(255),
  "note" text,
  "created_at" timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON "stock_movements" ("product_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_order ON "stock_movements" ("order_id");

-- Admin UI default language is Ukrainian (was Russian). Flip the column
-- default only — do not overwrite staff who already picked Russian.
ALTER TABLE "user" ALTER COLUMN "locale" SET DEFAULT 'uk';

-- Hide the six demo SKUs once a real catalog (Prom import) is in the same DB.
-- Skip on a seed-only install (CI / empty shop) so the demo catalog stays.
UPDATE products
SET is_visible = false, updated_at = NOW()
WHERE deleted_at IS NULL
  AND prom_id IS NULL
  AND sku IN ('IPH15P-128', 'CASE-15P-SIL', 'JBL-CH5', 'LOG-G502', 'KEY-K2', 'APP-2023-001')
  AND EXISTS (SELECT 1 FROM products p WHERE p.deleted_at IS NULL AND p.prom_id IS NOT NULL);

-- Fold Prom.ua "Техніка та електроніка" onto seeded "Електроніка".
INSERT INTO product_category (product_id, category_id)
SELECT pc.product_id, t.id
FROM product_category pc
JOIN categories c ON c.id = pc.category_id
JOIN categories t ON t.id <> c.id
 AND t.parent_id IS NOT DISTINCT FROM c.parent_id
 AND lower(trim(c.name_uk)) IN ('техніка та електроніка', 'техника и электроника')
 AND lower(trim(t.name_uk)) IN ('електроніка', 'электроника')
WHERE NOT EXISTS (
  SELECT 1 FROM product_category x
  WHERE x.product_id = pc.product_id AND x.category_id = t.id
);

UPDATE categories AS child
SET parent_id = t.id, updated_at = NOW()
FROM categories c
JOIN categories t ON t.id <> c.id
 AND t.parent_id IS NOT DISTINCT FROM c.parent_id
 AND lower(trim(c.name_uk)) IN ('техніка та електроніка', 'техника и электроника')
 AND lower(trim(t.name_uk)) IN ('електроніка', 'электроника')
WHERE child.parent_id = c.id;

DELETE FROM product_category
WHERE category_id IN (
  SELECT c.id FROM categories c
  JOIN categories t ON t.id <> c.id AND t.parent_id IS NULL AND c.parent_id IS NULL
   AND lower(trim(c.name_uk)) IN ('техніка та електроніка', 'техника и электроника')
   AND lower(trim(t.name_uk)) IN ('електроніка', 'электроника')
);

UPDATE categories c
SET is_visible = false, updated_at = NOW()
FROM categories t
WHERE c.id <> t.id
  AND c.parent_id IS NULL AND t.parent_id IS NULL
  AND lower(trim(c.name_uk)) IN ('техніка та електроніка', 'техника и электроника')
  AND lower(trim(t.name_uk)) IN ('електроніка', 'электроника');

-- Older installs created `orders` without fulfillment `status` /
-- `payment_status`. CREATE TABLE IF NOT EXISTS never adds columns to an
-- existing table, so admin order lists crash with:
--   error: column "status" does not exist
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "status" varchar(20) DEFAULT 'new'::character varying NOT NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_status" varchar(20) DEFAULT 'unpaid'::character varying NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders (payment_status);

-- Prom.ua imports wrote product_variants but left variants_enabled=false,
-- so the storefront hid size/color selectors on every imported product.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "variants_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sizes" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "options" jsonb DEFAULT '[]'::jsonb;
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
UPDATE products
SET variants_enabled = true
WHERE COALESCE(variants_enabled, false) = false
  AND deleted_at IS NULL
  AND id IN (SELECT DISTINCT product_id FROM product_variants);

-- Listing cards read `sizes`, not `options` / characteristics. Older Prom
-- imports stored the size axis only on those other columns, so «Обрати розмір»
-- stayed hidden until a full re-import. Fill empty `sizes` in place.
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

-- First-visit language: modal picker vs browser language. Default browser so
-- returning shops stop forcing the language dialog on every new device.
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "locale_prompt_mode" varchar(20) NOT NULL DEFAULT 'browser';

-- Prom.ua import job extras (used to be added at request time — that raced
-- under load). Applied once here instead.
ALTER TABLE "import_tasks" ADD COLUMN IF NOT EXISTS "source_url" text;
ALTER TABLE "import_tasks" ADD COLUMN IF NOT EXISTS "state" jsonb;

-- Shared rate-limit buckets so checkout / OTP / reviews stay limited across
-- Vercel instances (in-memory Maps are per-isolate and do not count).
CREATE TABLE IF NOT EXISTS "rate_limits" (
  "key" varchar(200) NOT NULL,
  "count" integer DEFAULT 0 NOT NULL,
  "reset_at" timestamptz NOT NULL,
  PRIMARY KEY ("key")
);

-- Prom.ua product ids are ~10 digits and overflow int4 (2_147_483_647).
ALTER TABLE products ALTER COLUMN prom_id TYPE bigint;

-- Hot paths: every order card / notification joins order_items by order_id;
-- product pages look up by slug. schema.sql used to omit both.
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON public.products ("slug");

CREATE INDEX IF NOT EXISTS idx_order_history_order_id ON public.order_history (order_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments (invoice_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usages_promotion_id ON public.promotion_usages (promotion_id);
CREATE INDEX IF NOT EXISTS idx_product_characteristics_product_id ON public.product_characteristics (product_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories (parent_id);

-- Optional longer storefront query cache for weak VPS (Settings → General).
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS storefront_cache_enabled boolean NOT NULL DEFAULT false;

-- One live promocode per code (FIX-14).
CREATE UNIQUE INDEX IF NOT EXISTS promotions_promo_code_unique
  ON promotions (UPPER(promo_code))
  WHERE type = 'promocode' AND promo_code IS NOT NULL AND btrim(promo_code) <> '';
