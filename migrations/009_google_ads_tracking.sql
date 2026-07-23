-- Marketing attribution: capture utm_* params present when the customer
-- landed on the site, so the admin can see which campaign actually drove
-- each order (independent of GA/Ads reporting, which can undercount due to
-- ad blockers, Safari ITP, consent choices, etc).
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "utm_source" varchar(150);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "utm_medium" varchar(150);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "utm_campaign" varchar(150);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "utm_term" varchar(150);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "utm_content" varchar(150);

-- Merchant Center feed extras (Настройки → Google Ads): google_product_category
-- + flat shipping rate, so Shopping listings stop risking disapproval/limited
-- impressions for missing these fields. Defaults to '{}' like the other
-- store_settings jsonb columns — no admin action required to keep old behavior.
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "merchant_feed" jsonb DEFAULT '{}'::jsonb NOT NULL;
