-- Older installs created `orders` without a fulfillment `status` column
-- (CREATE TABLE IF NOT EXISTS never adds columns to an existing table).
-- Admin order lists/stats query orders.status and crash with:
--   error: column "status" does not exist
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "status" varchar(20) DEFAULT 'new'::character varying NOT NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_status" varchar(20) DEFAULT 'unpaid'::character varying NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders (payment_status);
