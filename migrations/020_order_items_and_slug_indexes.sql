-- Hot paths that were missing from schema.sql:
--   order_items(order_id) — every order card, email and stock restore
--   products(slug)        — storefront product page lookup
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON public.products ("slug");
