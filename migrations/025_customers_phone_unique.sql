-- One live customer per phone so parallel checkouts cannot split stats
-- across duplicate rows (FIX-18). Soft-delete extras, keep the oldest id.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY phone ORDER BY id) AS rn
    FROM customers
   WHERE deleted_at IS NULL
     AND phone IS NOT NULL
     AND btrim(phone) <> ''
)
UPDATE customers
   SET deleted_at = NOW(),
       updated_at = NOW()
 WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_live_unique
  ON customers (phone)
  WHERE deleted_at IS NULL;
