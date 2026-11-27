# Database backups

Nightly PostgreSQL backup, fully inside the app — no GitHub Actions involved.

## How it works

- **Schedule:** Vercel Cron `GET /api/cron/db-backup`, daily at `30 0 * * *`
  (00:30 UTC ≈ 03:30 Kyiv in winter, 02:30 in summer). See `vercel.json`.
- **Auth:** `CRON_SECRET` Bearer token, fail-closed (`lib/cron-auth.ts`).
- **Format:** data-only gzipped NDJSON, encrypted with AES-256-GCM
  (`lib/shop/db-backup.ts`, `lib/shop/backup-crypto.ts`): files
  `YYYY-MM-DD-HHmmss.jsonl.gz.enc` —
  `[8-byte magic "PFBKUP01"][2-byte header length][JSON header {v:1,
  alg:"aes-256-gcm", keyId, nonce}][ciphertext][16-byte GCM tag]`.
  The manifest stays *inside* the encrypted stream: first line is a manifest
  (`{"_manifest":true,"dumpedAt":"...","retentionDays":10,"tables":[...]}`),
  then one `{"t":"table","r":{...row...}}` per row.
  The whole dump runs in a single `REPEATABLE READ` transaction, so the
  snapshot is consistent. Schema is NOT included — it lives in `db/migrate.sql`.
  The writer FAILS CLOSED without `BACKUP_ENCRYPTION_KEY` — it never writes
  an unencrypted backup. Plaintext `.jsonl.gz` files from before 3.4.109
  still restore (see Restore).
- **Storage:** local disk (`BACKUP_DIR` env, default `/app/data/backups`,
  named volume `techno_store_backups`), files `YYYY-MM-DD-HHmmss.jsonl.gz.enc`
  (plaintext `.jsonl.gz` files from before 3.4.109 are pruned by the same
  retention rule during the transition).
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
| `BACKUP_ENCRYPTION_KEY` | **Required since 3.4.109.** 32-byte base64 key for backup encryption (`openssl rand -base64 32`). The backup job fails closed without it; restores of `.jsonl.gz.enc` files need it too |
| `BACKUP_ENCRYPTION_KEY_ID` | keyId stamped on new backups (default: current UTC month `YYYY-MM`); set explicitly when rotating |
| `BACKUP_ENCRYPTION_KEY_<keyId>` | retained old keys, one per rotated keyId (e.g. `BACKUP_ENCRYPTION_KEY_2026-11`) — needed to restore backups made under that key |

The backup key is a new secret (generated once by `install.sh` /
`scripts/setup.sh`, printed once — see Key management below). On Vercel,
set the same value in Project Settings → Environment Variables so the cron
runtime can encrypt. Never commit the key, never put it in a backup file,
a ticket, or a log.

## Restore

```bash
# an encrypted backup (the normal case since 3.4.109 — the key must be in
# .env.local as BACKUP_ENCRYPTION_KEY, or exported for this one command
# from your password manager; never pass it as a CLI argument)
node --env-file=.env.local scripts/db-restore-backup.mjs ./backup.jsonl.gz.enc

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

## Key management

- **Generation:** `openssl rand -base64 32` (32 random bytes, base64).
  `install.sh` / `scripts/setup.sh` generate the key once when it is
  missing and print it **once** — store it in a password manager **and**
  an offline copy (paper / offline vault) at that moment. The only copy
  must never be the VPS disk itself.
- **Where it lives:** `.env.local` on the VPS (and Vercel env for the
  Vercel cron path); Docker installs keep it in `.env` and the app
  container must receive it via `docker-compose.yml` `app.environment`.
  The key is never written to the repo, to a backup file, or to any log.
- **What the keyId is for:** every encrypted backup carries a plaintext
  header with its `keyId` (e.g. `2026-11`), so a "which key do I need?"
  question is answerable from the backup file alone. The restorer looks
  the key up by that id: `BACKUP_ENCRYPTION_KEY_<keyId>` first, then the
  current `BACKUP_ENCRYPTION_KEY` when the id is the current one.
- **What encryption does NOT protect against:** an attacker with shell/env
  access to the running host (they read the env var), a compromised live
  DB, or a stolen `.env.local`. It protects the realistic case: backup
  files that leave the host (off-site copies, volume snapshots, support
  handoffs, discarded disks). File permissions (`0600`, 3.4.108) remain as
  defense-in-depth — encryption does not replace them.

## Rotation

1. Copy the current key value to `BACKUP_ENCRYPTION_KEY_<oldKeyId>`
   (the id stamped on the backups it made — read it from any recent
   backup header, or use the current `BACKUP_ENCRYPTION_KEY_ID`).
2. Set `BACKUP_ENCRYPTION_KEY_ID` to a new unique id (e.g. the next
   `YYYY-MM`).
3. Generate a new `BACKUP_ENCRYPTION_KEY` (`openssl rand -base64 32`)
   and store it like the first one (password manager + offline copy).
4. Restart / redeploy so the app and the cron pick up the new env.
5. Verify: the next nightly backup must restore — run the smoke check
   below on it.
6. Drop the old `BACKUP_ENCRYPTION_KEY_<oldKeyId>` only after no backup
   encrypted under it remains. Retention is 10 days, so 10 days after a
   rotation the old key is no longer needed. Rotation itself never
   destroys access to older backups — only deleting a retained key does.

## If the key is lost

**It is unrecoverable, by design.** AES-256-GCM with a lost 32-byte key
is not brute-forceable. Every backup encrypted under that `keyId` becomes
unreadable — permanently. There is no backdoor, no key escrow, and no
"reset" that can recover them.

If the current key is lost: (a) do NOT rotate-and-delete — generate a new
key for future backups, keep hunting for the old one; (b) fall back to the
most recent plaintext backup (pre-3.4.109) or the last backup under a
surviving key; (c) treat the lost-key backups as gone for planning
purposes. Blast radius is bounded by retention: at most 10 days of backups
are under any one key, and plaintext backups from before 3.4.109 remain
restorable regardless of keys.

## Verify a backup without risking production (smoke check)

After every rotation (and monthly otherwise): restore the latest backup
into a **scratch** database and confirm the row counts — the restore
verifies the GCM tag before committing, so a successful scratch restore
proves the key on file actually opens the backups. A key that was never
tested is a key that is already half-lost.

```bash
# scratch DB with the schema already applied (db/migrate.sql), then:
DATABASE_URL=<scratch-db-url> BACKUP_ENCRYPTION_KEY=<key> \
  node scripts/db-restore-backup.mjs ./latest.jsonl.gz.enc
# expect: "✓ Restored N rows into M tables"
```

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
