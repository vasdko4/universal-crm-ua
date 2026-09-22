-- Optional longer storefront query cache for weak VPS (Settings → General).
-- Off by default: catalog/product reads stay at 60s. On: 1 hour, still busted
-- immediately by revalidateStorefront() after admin product/category saves.
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS storefront_cache_enabled boolean NOT NULL DEFAULT false;
