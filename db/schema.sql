-- Techno Store — full schema (auto-generated)
-- Postgres 15+

CREATE TABLE IF NOT EXISTS "account" (
  "id" text NOT NULL,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "scope" text,
  "password" text,
  "createdAt" timestamptz DEFAULT now() NOT NULL,
  "updatedAt" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);


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


CREATE TABLE IF NOT EXISTS "article_categories" (
  "id" serial NOT NULL,
  "name" varchar(150) NOT NULL,
  "slug" varchar(150) NOT NULL,
  "description" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS article_categories_slug_key ON public.article_categories USING btree (slug);

CREATE TABLE IF NOT EXISTS "articles" (
  "id" serial NOT NULL,
  "title" varchar(255) NOT NULL,
  "slug" varchar(255) NOT NULL,
  "category_id" integer,
  "excerpt" text,
  "content" text,
  "cover_image" varchar(500),
  "author" varchar(150),
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "status" varchar(20) DEFAULT 'draft'::character varying NOT NULL,
  "is_featured" boolean DEFAULT false NOT NULL,
  "views_count" integer DEFAULT 0 NOT NULL,
  "reading_minutes" integer DEFAULT 1 NOT NULL,
  "meta_title" varchar(255),
  "meta_description" text,
  "published_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS articles_slug_key ON public.articles USING btree (slug);

CREATE TABLE IF NOT EXISTS "categories" (
  "id" serial NOT NULL,
  "name_uk" varchar(255) NOT NULL,
  "name_ru" varchar(255) NOT NULL,
  "slug" varchar(255) NOT NULL,
  "description_uk" text,
  "description_ru" text,
  "type" varchar(20) DEFAULT 'general'::character varying,
  "parent_id" integer,
  "image" varchar(255),
  "is_visible" boolean DEFAULT true,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);


CREATE TABLE IF NOT EXISTS "customer_contacts" (
  "id" serial NOT NULL,
  "customer_id" integer NOT NULL,
  "type" varchar(30) NOT NULL,
  "value" varchar(255) NOT NULL,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);


CREATE TABLE IF NOT EXISTS "customers" (
  "id" serial NOT NULL,
  "first_name" varchar(150) NOT NULL,
  "last_name" varchar(150),
  "phone" varchar(50) NOT NULL,
  "email" varchar(255),
  "reliability_score" integer DEFAULT 100 NOT NULL,
  "orders_count" integer DEFAULT 0 NOT NULL,
  "total_turnover" numeric(12,2) DEFAULT 0 NOT NULL,
  "last_order_date" timestamptz,
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "note" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "deleted_at" timestamptz,
  PRIMARY KEY ("id")
);


CREATE TABLE IF NOT EXISTS "delivery_methods" (
  "id" serial NOT NULL,
  "code" varchar(30) NOT NULL,
  "name" varchar(100) NOT NULL,
  "is_active" boolean DEFAULT true,
  "is_removable" boolean DEFAULT true,
  "config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS delivery_methods_code_key ON public.delivery_methods USING btree (code);

CREATE TABLE IF NOT EXISTS "discounts" (
  "id" serial NOT NULL,
  "name_uk" varchar(255) NOT NULL,
  "name_ru" varchar(255) NOT NULL,
  "type" varchar(20) DEFAULT 'percentage'::character varying,
  "value" numeric(10,2) NOT NULL,
  "start_date" timestamptz,
  "end_date" timestamptz,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);


CREATE TABLE IF NOT EXISTS "marketplace_categories" (
  "id" serial NOT NULL,
  "name_uk" varchar(255) NOT NULL,
  "name_ru" varchar(255) NOT NULL,
  "parent_id" integer,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);


CREATE TABLE IF NOT EXISTS "order_history" (
  "id" serial NOT NULL,
  "order_id" integer NOT NULL,
  "type" varchar(30) NOT NULL,
  "message" text NOT NULL,
  "actor" varchar(150),
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);


CREATE TABLE IF NOT EXISTS "order_items" (
  "id" serial NOT NULL,
  "order_id" integer NOT NULL,
  "product_id" integer,
  "variant_id" integer,
  "variant_label" varchar(255),
  "name" varchar(255) NOT NULL,
  "sku" varchar(100),
  "image" varchar(500),
  "price" numeric(12,2) DEFAULT 0 NOT NULL,
  "quantity" integer DEFAULT 1 NOT NULL,
  "total" numeric(12,2) DEFAULT 0 NOT NULL,
  "cost_price" numeric(12,2),
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);


CREATE TABLE IF NOT EXISTS "orders" (
  "id" serial NOT NULL,
  "order_number" varchar(30) NOT NULL,
  "status" varchar(20) DEFAULT 'new'::character varying NOT NULL,
  "customer_id" integer,
  "customer_name" varchar(255),
  "customer_phone" varchar(50),
  "customer_email" varchar(255),
  "delivery_method" varchar(40),
  "delivery_city" varchar(255),
  "delivery_branch" varchar(255),
  "delivery_address" text,
  "tracking_number" varchar(100),
  "delivery_status" varchar(100),
  "payment_method" varchar(40),
  "payment_status" varchar(20) DEFAULT 'unpaid'::character varying NOT NULL,
  "items_total" numeric(12,2) DEFAULT 0 NOT NULL,
  "delivery_cost" numeric(12,2) DEFAULT 0 NOT NULL,
  "discount_total" numeric(12,2) DEFAULT 0 NOT NULL,
  "total" numeric(12,2) DEFAULT 0 NOT NULL,
  "items_count" integer DEFAULT 0 NOT NULL,
  "currency" varchar(10) DEFAULT 'UAH'::character varying NOT NULL,
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "note" text,
  "created_by" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "user_id" text,
  "promo_code" varchar(80),
  "stock_restored" boolean DEFAULT false NOT NULL,
  "utm_source" varchar(150),
  "utm_medium" varchar(150),
  "utm_campaign" varchar(150),
  "utm_term" varchar(150),
  "utm_content" varchar(150),
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_key ON public.orders USING btree (order_number);

CREATE TABLE IF NOT EXISTS "pages" (
  "id" serial NOT NULL,
  "title" varchar(255) NOT NULL,
  "title_ru" varchar(255),
  "slug" varchar(255) NOT NULL,
  "content" text,
  "content_ru" text,
  "excerpt" text,
  "excerpt_ru" text,
  "cover_image" varchar(500),
  "template" varchar(30) DEFAULT 'default'::character varying NOT NULL,
  "status" varchar(20) DEFAULT 'draft'::character varying NOT NULL,
  "show_in_menu" boolean DEFAULT false NOT NULL,
  "menu_title" varchar(150),
  "sort_order" integer DEFAULT 0 NOT NULL,
  "meta_title" varchar(255),
  "meta_description" text,
  "published_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS pages_slug_key ON public.pages USING btree (slug);

CREATE TABLE IF NOT EXISTS "payment_events" (
  "id" serial NOT NULL,
  "payment_id" integer NOT NULL,
  "type" varchar(30) NOT NULL,
  "status" varchar(20),
  "amount" numeric(12,2),
  "message" text,
  "payload" jsonb,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);


CREATE TABLE IF NOT EXISTS "payment_gateways" (
  "id" serial NOT NULL,
  "code" varchar(30) NOT NULL,
  "name" varchar(100) NOT NULL,
  "is_active" boolean DEFAULT false,
  "is_test_mode" boolean DEFAULT true,
  "config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_gateways_code_key ON public.payment_gateways USING btree (code);

CREATE TABLE IF NOT EXISTS "payment_methods" (
  "id" serial NOT NULL,
  "code" varchar(30) NOT NULL,
  "name" varchar(100) NOT NULL,
  "is_active" boolean DEFAULT true,
  "config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_methods_code_key ON public.payment_methods USING btree (code);

CREATE TABLE IF NOT EXISTS "payments" (
  "id" serial NOT NULL,
  "gateway_code" varchar(30) NOT NULL,
  "order_reference" varchar(100) NOT NULL,
  "invoice_id" varchar(150),
  "amount" numeric(12,2) NOT NULL,
  "currency" varchar(10) DEFAULT 'UAH'::character varying NOT NULL,
  "status" varchar(20) DEFAULT 'created'::character varying NOT NULL,
  "description" text,
  "customer_name" varchar(255),
  "customer_email" varchar(255),
  "customer_phone" varchar(50),
  "payment_url" text,
  "refunded_amount" numeric(12,2) DEFAULT 0 NOT NULL,
  "raw_response" jsonb,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS payments_order_reference_key ON public.payments USING btree (order_reference);

CREATE TABLE IF NOT EXISTS "product_category" (
  "id" serial NOT NULL,
  "product_id" integer NOT NULL,
  "category_id" integer NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS product_category_product_id_category_id_key ON public.product_category USING btree (product_id, category_id);

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


CREATE TABLE IF NOT EXISTS "product_group_items" (
  "id" serial NOT NULL,
  "product_id" integer NOT NULL,
  "group_id" integer NOT NULL,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS product_group_items_product_id_group_id_key ON public.product_group_items USING btree (product_id, group_id);

CREATE TABLE IF NOT EXISTS "product_groups" (
  "id" serial NOT NULL,
  "name_uk" varchar(255) NOT NULL,
  "name_ru" varchar(255) NOT NULL,
  "slug" varchar(255) NOT NULL,
  "description_uk" text,
  "description_ru" text,
  "sort_order" integer DEFAULT 0,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);


CREATE TABLE IF NOT EXISTS "product_images" (
  "id" serial NOT NULL,
  "product_id" integer NOT NULL,
  "image_url" varchar(500) NOT NULL,
  "is_primary" boolean DEFAULT false,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);


CREATE TABLE IF NOT EXISTS "product_questions" (
  "id" serial NOT NULL,
  "product_id" integer NOT NULL,
  "author_name" varchar(150) NOT NULL,
  "author_email" varchar(255),
  "question" text NOT NULL,
  "answer" text,
  "status" varchar(20) DEFAULT 'pending'::character varying NOT NULL,
  "answered_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);


CREATE TABLE IF NOT EXISTS "product_reviews" (
  "id" serial NOT NULL,
  "product_id" integer NOT NULL,
  "author_name" varchar(150) NOT NULL,
  "author_email" varchar(255),
  "rating" integer DEFAULT 5 NOT NULL,
  "title" varchar(255),
  "body" text NOT NULL,
  "pros" text,
  "cons" text,
  "status" varchar(20) DEFAULT 'pending'::character varying NOT NULL,
  "is_verified_purchase" boolean DEFAULT false NOT NULL,
  "admin_reply" text,
  "helpful_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);


CREATE TABLE IF NOT EXISTS "products" (
  "id" serial NOT NULL,
  "name_uk" varchar(255),
  "name_ru" varchar(255),
  "description_uk" text,
  "description_ru" text,
  "private_notes" text,
  "sales_type" varchar(20) DEFAULT 'retail'::character varying,
  "sku" varchar(100),
  "barcode" varchar(100),
  "prom_id" integer,
  "price" numeric(10,2) DEFAULT 0 NOT NULL,
  "price_from" boolean DEFAULT false,
  "currency" varchar(10) DEFAULT 'UAH'::character varying,
  "old_price" numeric(10,2),
  "cost_price" numeric(10,2),
  "quantity" integer DEFAULT 0 NOT NULL,
  "unit" varchar(50) DEFAULT 'шт'::character varying,
  "stock_status" varchar(50) DEFAULT 'В наличии'::character varying,
  "site_group_id" integer,
  "marketplace_category_id" integer,
  "width" numeric(10,2),
  "height" numeric(10,2),
  "length" numeric(10,2),
  "weight" numeric(10,3),
  "image" varchar(500),
  "images" jsonb DEFAULT '[]'::jsonb,
  "sizes" jsonb DEFAULT '[]'::jsonb,
  "options" jsonb DEFAULT '[]'::jsonb,
  "variants_enabled" boolean DEFAULT false NOT NULL,
  "is_visible" boolean DEFAULT true,
  "is_in_stock" boolean DEFAULT true,
  "is_popular" boolean DEFAULT false,
  "sort_order" integer DEFAULT 0,
  "views_count" integer DEFAULT 0,
  "orders_count" integer DEFAULT 0,
  "purchases_boost" integer DEFAULT 0 NOT NULL,
  "meta_title_uk" varchar(255),
  "meta_title_ru" varchar(255),
  "meta_description_uk" text,
  "meta_description_ru" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "deleted_at" timestamptz,
  PRIMARY KEY ("id")
);


CREATE TABLE IF NOT EXISTS "product_variants" (
  "id" serial NOT NULL,
  "product_id" integer NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS product_variants_product_id_idx ON public.product_variants USING btree (product_id);

CREATE TABLE IF NOT EXISTS "admin_logs" (
  "id" serial NOT NULL,
  "user_id" text,
  "user_name" varchar(255),
  "user_email" varchar(255),
  "action" varchar(30) NOT NULL,
  "entity" varchar(50) NOT NULL,
  "entity_id" varchar(100),
  "details" text,
  "ip" varchar(100),
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS admin_logs_created_at_idx ON public.admin_logs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_logs_entity_idx ON public.admin_logs USING btree (entity);

CREATE TABLE IF NOT EXISTS "modal_ads" (
  "id" serial NOT NULL,
  "name" varchar(255) NOT NULL,
  "title" varchar(255) NOT NULL,
  "body" text,
  "image_url" varchar(500),
  "button_text" varchar(120),
  "button_url" varchar(500),
  "button_color" varchar(20) DEFAULT '' NOT NULL,
  "target_pages" jsonb DEFAULT '["all"]'::jsonb NOT NULL,
  "trigger_type" varchar(20) DEFAULT 'delay'::character varying NOT NULL,
  "trigger_value" integer DEFAULT 5 NOT NULL,
  "frequency" varchar(20) DEFAULT 'session'::character varying NOT NULL,
  "frequency_days" integer DEFAULT 7 NOT NULL,
  "size" varchar(20) DEFAULT 'medium'::character varying NOT NULL,
  "starts_at" timestamptz DEFAULT now() NOT NULL,
  "ends_at" timestamptz,
  "is_active" boolean DEFAULT true NOT NULL,
  "views_count" integer DEFAULT 0 NOT NULL,
  "clicks_count" integer DEFAULT 0 NOT NULL,
  "closes_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "promotion_usages" (
  "id" serial NOT NULL,
  "promotion_id" integer NOT NULL,
  "order_reference" varchar(100),
  "order_amount" numeric(12,2) DEFAULT 0 NOT NULL,
  "discount_amount" numeric(12,2) DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);


CREATE TABLE IF NOT EXISTS "promotions" (
  "id" serial NOT NULL,
  "type" varchar(20) DEFAULT 'promocode'::character varying NOT NULL,
  "name" varchar(255) NOT NULL,
  "discount_type" varchar(20) DEFAULT 'percentage'::character varying NOT NULL,
  "discount_value" numeric(12,2) DEFAULT 0 NOT NULL,
  "promo_code" varchar(80),
  "target_type" varchar(20) DEFAULT 'all'::character varying NOT NULL,
  "target_group_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "target_product_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "usage_limit" integer,
  "min_order_amount" numeric(12,2),
  "no_stacking" boolean DEFAULT false NOT NULL,
  "exclude_wholesale" boolean DEFAULT false NOT NULL,
  "starts_at" timestamptz DEFAULT now() NOT NULL,
  "ends_at" timestamptz,
  "is_active" boolean DEFAULT true NOT NULL,
  "used_count" integer DEFAULT 0 NOT NULL,
  "total_orders_amount" numeric(14,2) DEFAULT 0 NOT NULL,
  "total_discount_amount" numeric(14,2) DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);


CREATE TABLE IF NOT EXISTS "roles" (
  "id" serial NOT NULL,
  "code" varchar(40) NOT NULL,
  "name" varchar(120) NOT NULL,
  "description" text,
  "permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "is_system" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS roles_code_key ON public.roles USING btree (code);

CREATE TABLE IF NOT EXISTS "session" (
  "id" text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "token" text NOT NULL,
  "createdAt" timestamptz DEFAULT now() NOT NULL,
  "updatedAt" timestamptz DEFAULT now() NOT NULL,
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS session_token_key ON public.session USING btree (token);

CREATE TABLE IF NOT EXISTS "site_groups" (
  "id" serial NOT NULL,
  "name_uk" varchar(255) NOT NULL,
  "name_ru" varchar(255) NOT NULL,
  "slug" varchar(255) NOT NULL,
  "is_active" boolean DEFAULT true,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);


CREATE TABLE IF NOT EXISTS "store_settings" (
  "id" integer DEFAULT 1 NOT NULL,
  "store_name" varchar(255) DEFAULT 'Мой магазин'::character varying NOT NULL,
  "store_description" text,
  "logo_url" varchar(500),
  "favicon_url" varchar(500),
  "open_cart_after_add" boolean DEFAULT true NOT NULL,
  "default_locale" varchar(5) DEFAULT 'uk'::character varying NOT NULL,
  "active_template" varchar(30) DEFAULT 'classic'::character varying NOT NULL,
  "social" jsonb DEFAULT '{"viber": {"url": "", "enabled": false}, "tiktok": {"url": "", "enabled": false}, "telegram": {"url": "", "enabled": false}, "instagram": {"url": "", "enabled": false}}'::jsonb NOT NULL,
  "google_ads" jsonb DEFAULT '{"enabled": false, "conversionId": "", "conversionLabel": ""}'::jsonb NOT NULL,
  "merchant_feed" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "email_settings" jsonb DEFAULT '{"enabled": false, "fromName": "", "provider": "gmail", "smtpHost": "", "smtpPort": "587", "smtpUser": "", "fromEmail": "", "smtpPassword": "", "dkimSelector": "", "dkimPrivateKey": ""}'::jsonb NOT NULL,
  "contact" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "seo" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "notifications" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "google_auth" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "home_hero" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);


CREATE TABLE IF NOT EXISTS "user" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "emailVerified" boolean DEFAULT false NOT NULL,
  "image" text,
  "role" text DEFAULT 'manager'::text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "createdAt" timestamptz DEFAULT now() NOT NULL,
  "updatedAt" timestamptz DEFAULT now() NOT NULL,
  "phone" varchar(50),
  "locale" varchar(5) DEFAULT 'ru'::character varying NOT NULL,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS user_email_key ON public."user" USING btree (email);

CREATE TABLE IF NOT EXISTS "verification" (
  "id" text NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz DEFAULT now() NOT NULL,
  "updatedAt" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);


CREATE TABLE IF NOT EXISTS "import_tasks" (
  "id" serial NOT NULL,
  "file_name" varchar(255) NOT NULL,
  "source_type" varchar(20) DEFAULT 'local'::character varying NOT NULL,
  "status" varchar(20) DEFAULT 'pending'::character varying,
  "total_items" integer DEFAULT 0,
  "processed_items" integer DEFAULT 0,
  "success_items" integer DEFAULT 0,
  "failed_items" integer DEFAULT 0,
  "error_log" text,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);


-- Storefront customer favorites (wishlist). One row per (user, product).
CREATE TABLE IF NOT EXISTS "user_favorites" (
  "id" serial NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "product_id" integer NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS user_favorites_user_product_key
  ON public."user_favorites" USING btree ("user_id", "product_id");
CREATE INDEX IF NOT EXISTS user_favorites_user_idx
  ON public."user_favorites" USING btree ("user_id");


-- Saved delivery addresses for storefront customers.
CREATE TABLE IF NOT EXISTS "user_addresses" (
  "id" serial NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "label" varchar(120),
  "first_name" varchar(150) NOT NULL,
  "last_name" varchar(150),
  "phone" varchar(50) NOT NULL,
  "delivery_method" varchar(30) NOT NULL DEFAULT 'nova_poshta',
  "city" varchar(255),
  "city_ref" varchar(120),
  "branch" varchar(255),
  "branch_type" varchar(20) DEFAULT 'branch',
  "post_index" varchar(20),
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS user_addresses_user_idx
  ON public."user_addresses" USING btree ("user_id");



-- Performance indexes for analytics and order queries
CREATE INDEX IF NOT EXISTS idx_ae_product_type_created ON public.analytics_events (product_id, type, created_at);
CREATE INDEX IF NOT EXISTS idx_ae_type_created ON public.analytics_events (type, created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON public.order_items (product_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON public.orders (created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_products_visible ON public.products (is_visible) WHERE deleted_at IS NULL;

-- Hot storefront paths that were missing an index, causing full table/index
-- scans on category pages and every product page (reviews/questions tabs)
-- once data grows — noticeable on a weak/low-CPU VPS.
CREATE INDEX IF NOT EXISTS idx_product_category_category_id ON public.product_category (category_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_status ON public.product_reviews (product_id, status);
CREATE INDEX IF NOT EXISTS idx_product_reviews_status_created ON public.product_reviews (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_questions_product_status ON public.product_questions (product_id, status);
CREATE INDEX IF NOT EXISTS idx_product_questions_status_created ON public.product_questions (status, created_at DESC);

-- Schema drift fixes: columns expected by the Drizzle schema
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS promo_code varchar(80);
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS contact jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS seo jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS notifications jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS home_hero jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.modal_ads ADD COLUMN IF NOT EXISTS button_color varchar(20) NOT NULL DEFAULT '';

-- Abandoned carts: visitors who started checkout but never placed the order
CREATE TABLE IF NOT EXISTS "abandoned_carts" (
  "id" serial PRIMARY KEY,
  "token" varchar(64) NOT NULL UNIQUE,
  "customer_name" varchar(255),
  "customer_phone" varchar(50),
  "customer_email" varchar(255),
  "items" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "items_total" numeric(12,2) DEFAULT 0 NOT NULL,
  "items_count" integer DEFAULT 0 NOT NULL,
  "status" varchar(20) DEFAULT 'open'::character varying NOT NULL,
  "reminded_at" timestamptz,
  "recovered_order_number" varchar(100),
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS abandoned_carts_status_idx ON public.abandoned_carts USING btree (status, updated_at DESC);

-- Минимальная сумма заказа: включение/выключение + порог (Настройки → Общие)
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS min_order jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Реальный URL фискального чека от эквайринга (WayForPay/Monobank), если API
-- шлюза его вернул. NULL — чек заказа показывает нефискальный QR на магазин.
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS receipt_url text;
