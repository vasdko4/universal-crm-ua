-- Persist Nova Poshta refs on orders so TTN can use WarehouseWarehouse.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_city_ref" varchar(64);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_warehouse_ref" varchar(64);

-- Stock ledger: who changed quantity, why, and by how much.
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
