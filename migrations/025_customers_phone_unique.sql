-- One live customer per phone (FIX-18). Soft-delete extras, keep the oldest
-- id, and fold their orders/contacts/stats onto it so the unique index can
-- be created on databases that already raced.
WITH ranked AS (
  SELECT id,
         FIRST_VALUE(id) OVER (PARTITION BY phone ORDER BY id) AS keep_id,
         ROW_NUMBER() OVER (PARTITION BY phone ORDER BY id) AS rn
    FROM customers
   WHERE deleted_at IS NULL
)
UPDATE orders o
   SET customer_id = r.keep_id
  FROM ranked r
 WHERE o.customer_id = r.id
   AND r.rn > 1;

WITH ranked AS (
  SELECT id,
         FIRST_VALUE(id) OVER (PARTITION BY phone ORDER BY id) AS keep_id,
         ROW_NUMBER() OVER (PARTITION BY phone ORDER BY id) AS rn
    FROM customers
   WHERE deleted_at IS NULL
)
UPDATE customer_contacts cc
   SET customer_id = r.keep_id
  FROM ranked r
 WHERE cc.customer_id = r.id
   AND r.rn > 1;

WITH ranked AS (
  SELECT id,
         FIRST_VALUE(id) OVER (PARTITION BY phone ORDER BY id) AS keep_id,
         ROW_NUMBER() OVER (PARTITION BY phone ORDER BY id) AS rn
    FROM customers
   WHERE deleted_at IS NULL
), keep_ids AS (
  SELECT DISTINCT keep_id FROM ranked WHERE rn > 1
), stats AS (
  SELECT o.customer_id AS id,
         COUNT(*)::int AS orders_count,
         COALESCE(SUM(o.total), 0) AS total_turnover,
         MAX(o.created_at) AS last_order_date
    FROM orders o
    JOIN keep_ids k ON k.keep_id = o.customer_id
   GROUP BY o.customer_id
)
UPDATE customers c
   SET orders_count = s.orders_count,
       total_turnover = s.total_turnover,
       last_order_date = s.last_order_date,
       updated_at = NOW()
  FROM stats s
 WHERE c.id = s.id;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY phone ORDER BY id) AS rn
    FROM customers
   WHERE deleted_at IS NULL
)
UPDATE customers
   SET deleted_at = NOW(),
       updated_at = NOW()
 WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_live_unique
  ON customers (phone)
  WHERE deleted_at IS NULL;
