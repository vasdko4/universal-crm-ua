-- Missing indexes on hot storefront paths. Without these, the category page
-- and the reviews/questions tabs on every product page do a full table scan
-- (product_category only had a unique index led by product_id, and
-- product_reviews/product_questions had no index on product_id at all).
-- Noticeable slowdown as the catalog/reviews grow, especially on a low-CPU VPS.
CREATE INDEX IF NOT EXISTS idx_product_category_category_id ON product_category (category_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_status ON product_reviews (product_id, status);
CREATE INDEX IF NOT EXISTS idx_product_reviews_status_created ON product_reviews (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_questions_product_status ON product_questions (product_id, status);
CREATE INDEX IF NOT EXISTS idx_product_questions_status_created ON product_questions (status, created_at DESC);
