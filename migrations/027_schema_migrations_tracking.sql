CREATE TABLE IF NOT EXISTS public.schema_migrations (
  id integer PRIMARY KEY,
  migrate_sql_sha256 varchar(64) NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT schema_migrations_single_row CHECK (id = 1)
);
