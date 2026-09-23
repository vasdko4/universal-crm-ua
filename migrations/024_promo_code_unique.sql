-- One live promocode per code so checkout evaluation and fulfillment
-- cannot resolve two different promotions (FIX-14).
-- Keep the lowest id when duplicates already exist.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY UPPER(promo_code) ORDER BY id) AS rn
    FROM promotions
   WHERE type = 'promocode'
     AND promo_code IS NOT NULL
     AND btrim(promo_code) <> ''
)
UPDATE promotions
   SET promo_code = promo_code || '-DUP' || id,
       is_active = false,
       updated_at = NOW()
 WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS promotions_promo_code_unique
  ON promotions (UPPER(promo_code))
  WHERE type = 'promocode' AND promo_code IS NOT NULL AND btrim(promo_code) <> '';
