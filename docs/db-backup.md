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
- **Storage:** Vercel Blob (private), `db-backups/YYYY-MM-DD-HHmm.jsonl.gz`.
- **Retention:** backups older than **10 days** are deleted automatically
  on every run (matched by filename date). A backup exactly 10 days old is kept.
- **Failure:** `reportError('cron:db-backup', …, { alertAdmin: true })` —
  structured log + Telegram alert to the admin chat.
- **Timeout:** `maxDuration = 300` (5 min). A safety valve aborts the dump
  above 2M rows instead of OOM-killing the function.

## Required env (Vercel project — already used by the app)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | production Postgres |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob (already used for uploads) |
| `CRON_SECRET` | cron auth (already used by other crons) |

No new secrets, nothing in GitHub.

## Restore

```bash
# newest backup from Blob into the DB pointed to by DATABASE_URL
node --env-file=.env.local scripts/db-restore-backup.mjs --latest

# a specific backup
node --env-file=.env.local scripts/db-restore-backup.mjs db-backups/2026-10-01-0030.jsonl.gz

# a local file (e.g. downloaded from the Vercel dashboard)
node --env-file=.env.local scripts/db-restore-backup.mjs ./backup.jsonl.gz
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

- The dump buffers tables in memory; fine for this store's size. If the DB
  ever grows past a few hundred MB, switch `runDatabaseBackup` to chunked
  `COPY` streaming.
- `bytea` columns round-trip via Buffer JSON encoding; `timestamptz` via ISO
  strings — both restored correctly by `scripts/db-restore-backup.mjs`.
