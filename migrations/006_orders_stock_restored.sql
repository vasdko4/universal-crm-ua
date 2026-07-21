-- Tracks whether stock has already been restored for a cancelled order, so
-- toggling an order's status back and forth (cancelled -> new -> cancelled)
-- never double-counts the restock. See updateOrderStatus() in
-- app/actions/orders.ts.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "stock_restored" boolean DEFAULT false NOT NULL;
