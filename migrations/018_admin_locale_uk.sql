-- Admin UI default language is Ukrainian (was Russian).
ALTER TABLE "user" ALTER COLUMN "locale" SET DEFAULT 'uk';
UPDATE "user" SET "locale" = 'uk' WHERE "locale" = 'ru';
