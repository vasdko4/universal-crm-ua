-- SEO settings for the store: canonical domain, meta title/description,
-- Google Search Console verification token. Stored as jsonb, editable in
-- the admin panel and pre-filled by the setup wizard.
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS seo jsonb NOT NULL DEFAULT '{}'::jsonb;
