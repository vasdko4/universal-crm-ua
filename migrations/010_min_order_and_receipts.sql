-- Минимальная сумма заказа: включение/выключение + порог (Настройки → Общие)
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS min_order jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Реальный URL фискального чека от эквайринга (WayForPay/Monobank), если API
-- шлюза его вернул. NULL — чек заказа показывает нефискальный QR на магазин.
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS receipt_url text;
