# Database backups

Nightly PostgreSQL backup, fully inside the app — no GitHub Actions involved.

## How it works

- **Schedule:** Vercel Cron `GET /api/cron/db-backup`, daily at `30 0 * * *`
  (00:30 UTC ≈ 03:30 Kyiv in winter, 02:30 in summer). See `vercel.json`.
- **Auth:** `CRON_SECRET` Bearer token, fail-closed (`lib/cron-auth.ts`).
- **Format:** data-only gzipped NDJSON (`lib/shop/db-backup.ts`):
  first line is a manifest
  (`{"_manifest":true,"dumpedAt":"...","retentionDays":10,"tables":[...]}`),
  then one `{"t":"table","r":{...row...}}` per row.
  The whole dump runs in a single `REPEATABLE READ` transaction, so the
  snapshot is consistent. Schema is NOT included — it lives in `db/migrate.sql`.
- **Storage:** local disk (`BACKUP_DIR` env, default `/app/data/backups`,
  named volume `techno_store_backups`), files `YYYY-MM-DD-HHmmss.jsonl.gz`.
- **Retention:** backups older than **10 days** are deleted automatically
  on every run (matched by filename date). A backup exactly 10 days old is kept.
- **Failure:** `reportError('cron:db-backup', …, { alertAdmin: true })` —
  structured log + Telegram alert to the admin chat.
- **Timeout:** `maxDuration = 300` (5 min). A safety valve aborts the dump
  above 2M rows instead of OOM-killing the function.

## Required env

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | production Postgres |
| `CRON_SECRET` | cron auth (already used by other crons) |
| `BLOB_READ_WRITE_TOKEN` | only for restoring old backups stored in Vercel Blob (`--latest` / `db-backups/...` paths); not needed for local-disk backups |

No new secrets, nothing in GitHub.

## Restore

```bash
# a local backup file (the normal case — backups live on local disk now)
node --env-file=.env.local scripts/db-restore-backup.mjs ./backup.jsonl.gz

# newest backup from Blob (only for old backups stored in Vercel Blob)
node --env-file=.env.local scripts/db-restore-backup.mjs --latest

# a specific Blob backup
node --env-file=.env.local scripts/db-restore-backup.mjs db-backups/2026-10-01-0030.jsonl.gz
```

The script TRUNCATEs every dumped table (CASCADE) and re-INSERTs rows in one
transaction — it rolls back on any error. **It wipes the target database**,
so double-check `DATABASE_URL` first. Apply `db/migrate.sql` first if the
target schema is empty/outdated (Admin → Updates → «Перевірити версію БД»).

## Manual run

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/db-backup
```

## Limits

- The dump streams rows in 10k batches through gzip (no whole-table
  buffering); safety valves abort above 2M rows (checked up front via
  `COUNT(*)`) or 512 MB compressed output.
- The manifest records the app version, the `schema_migrations` sha and the
  sequence positions at dump time; the restorer replays them with `setval`
  and warns loudly on a version/schema mismatch. Old manifests without
  these fields still restore (sequences fall back to `MAX(id)`).
- `bytea` columns round-trip via Buffer JSON encoding; `timestamptz` via ISO
  strings — both restored correctly by `scripts/db-restore-backup.mjs`.
