-- H4: join/filter indexes that schema.sql used to omit.
CREATE INDEX IF NOT EXISTS idx_order_history_order_id ON public.order_history (order_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments (invoice_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usages_promotion_id ON public.promotion_usages (promotion_id);
CREATE INDEX IF NOT EXISTS idx_product_characteristics_product_id ON public.product_characteristics (product_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories (parent_id);
