-- Prom.ua product ids (~10 digits) overflow int4. Drizzle already uses bigint;
-- the live column was still integer, so every real Prom import failed with
-- "integer out of range".
ALTER TABLE products ALTER COLUMN prom_id TYPE bigint;
