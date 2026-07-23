-- Автоматические скидки (акции type='discount' без промокода) раньше
-- сохранялись в админке, но нигде не применялись — ни в корзине, ни при
-- оформлении заказа. Эти колонки фиксируют, какая автоматическая акция и на
-- какую сумму была применена к заказу (отдельно от вручную введённого
-- promo_code), чтобы статистика использования в /admin/promotions была
-- точной для обоих типов акций одновременно.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "auto_discount_id" integer;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "auto_discount_amount" numeric(12,2);
