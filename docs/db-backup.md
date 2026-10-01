# Database backups

Production PostgreSQL is backed up automatically by the `DB backup` GitHub
workflow (`.github/workflows/db-backup.yml`). Dumps are stored in Vercel Blob
as `db-backups/YYYY-MM-DD-HHmm.dump` (timestamp in Europe/Kyiv).

## Schedule and retention

- Runs daily at `01:30 UTC` — that's `03:30 Europe/Kyiv` in winter (UTC+2)
  and `04:30` in summer (UTC+3, DST), because GitHub cron always uses UTC.
- Retention: **10 days**. Every run deletes all dumps **strictly older than
  10 days**. A dump that is exactly 10 days old is kept; one that is
  10 days + 1 minute old is deleted. Objects whose names don't match the
  `YYYY-MM-DD-HHmm.dump` pattern are never deleted automatically.

## Required GitHub Secrets

Configure under **Settings → Secrets and variables → Actions**:

| Secret | Description |
|---|---|
| `DATABASE_URL` | Production Postgres connection string (read access is enough for `pg_dump`). |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob read/write token of the store used for backups. |

## Manual run

1. Go to **Actions → DB backup → Run workflow**.
2. The run dumps the database with
   `pg_dump -Fc --no-owner --no-acl` and uploads it via
   `scripts/db-backup.mjs`, which also prunes expired dumps.

To dry-run the prune step locally (lists what would be deleted, deletes
nothing):

```bash
BLOB_READ_WRITE_TOKEN=<token> node scripts/db-backup.mjs /tmp/db-backup.dump --dry-run
```

## Restore from a backup

Download the `.dump` file from the Blob store (Vercel dashboard or API),
then restore with `pg_restore`:

```bash
# Restore into an empty database (recommended for a full disaster recovery):
pg_restore --clean --if-exists -d "$DATABASE_URL" db-backups-2026-10-01-0330.dump
```

Notes:

- Dumps are taken with `--no-owner --no-acl`, so they restore cleanly into a
  database owned by a different role.
- `--clean --if-exists` drops existing objects before recreating them —
  only use it when you intend to replace the target database.
- Always restore to a staging database first and verify the application
  boots against it before touching production.
- The custom format (`-Fc`) is compressed; use `pg_restore -l file.dump` to
  list its contents without restoring.
