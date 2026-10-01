-- Visual themes for modal advertisements.
ALTER TABLE public.modal_ads
  ADD COLUMN IF NOT EXISTS theme varchar(20) NOT NULL DEFAULT 'classic';

-- Encrypted TOTP secrets are larger than the original plaintext values.
ALTER TABLE "user"
  ALTER COLUMN two_factor_secret TYPE varchar(255),
  ALTER COLUMN two_factor_pending_secret TYPE varchar(255);
