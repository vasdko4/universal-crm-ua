-- Staff TOTP (admin 2FA). Secret stays on the user row; cookie is HMAC'd separately.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "two_factor_secret" varchar(64);
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "two_factor_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "two_factor_pending_secret" varchar(64);

-- Optional sender refs for Nova Poshta InternetDocument (saved in delivery_methods.config).
-- No schema change: config is already jsonb.
