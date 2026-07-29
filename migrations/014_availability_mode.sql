-- "Скоро в наличии" / предзаказ: позволяет админу пометить товар с нулевым
-- остатком как всё ещё показываемый на витрине вместо полного скрытия.
-- 'default'      — обычное поведение (скрыт на главной, исключён из фида
--                  Google Merchant, в самом конце результатов поиска).
-- 'coming_soon'  — виден с бейджем "Скоро в наличии", покупка недоступна.
-- 'preorder'     — виден, доступен к заказу, в фиде Google Merchant
--                  передаётся как g:availability=preorder.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "availability_mode" varchar(20) DEFAULT 'default'::character varying NOT NULL;
