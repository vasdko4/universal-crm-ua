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
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "locale" varchar(5) DEFAULT 'ru'::character varying NOT NULL;

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

-- ---------- Готово ----------
DO $$ BEGIN RAISE NOTICE 'Миграция применена успешно.'; END $$;
