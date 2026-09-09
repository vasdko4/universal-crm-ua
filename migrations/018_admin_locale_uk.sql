-- Admin UI default language is Ukrainian (was Russian).
-- Only the column default changes. Existing rows keep their chosen locale.
ALTER TABLE "user" ALTER COLUMN "locale" SET DEFAULT 'uk';
