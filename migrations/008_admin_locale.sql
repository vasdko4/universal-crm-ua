-- Локализация админ-центра: язык интерфейса привязывается к администратору
-- и хранится в БД (user.locale), а не спрашивается при каждом входе.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "locale" varchar(5) DEFAULT 'ru'::character varying NOT NULL;
