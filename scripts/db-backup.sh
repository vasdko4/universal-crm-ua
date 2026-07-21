#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Techno Store — daily production database backup.
#
# Installed automatically by scripts/vps-install.sh as a systemd timer
# (runs once a day). Can also be run manually:
#
#   DATABASE_URL="postgres://..." bash scripts/db-backup.sh
#
# What it does:
#   1. pg_dump's the database to a timestamped, compressed custom-format file
#      under BACKUP_DIR (default /var/backups/techno-store).
#   2. Deletes local backups older than RETENTION_DAYS (default 14).
#   3. If RCLONE_REMOTE is set (e.g. "b2:my-bucket/techno-store-backups"),
#      copies the new backup off the server with rclone — do this if the
#      backup matters, a local-disk-only backup does not protect against
#      disk failure/host loss. rclone supports S3, Backblaze B2, Google
#      Drive, and many others; configure it once with `rclone config`.
#
# Restore a backup:
#   pg_restore --clean --if-exists -d "$DATABASE_URL" /path/to/backup.dump
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/techno-store}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
DATABASE_URL="${DATABASE_URL:?Set DATABASE_URL (or run via the systemd unit, which loads .env.production)}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
DEST="$BACKUP_DIR/techno-store_${STAMP}.dump"

pg_dump --format=custom --compress=6 --file="$DEST" --dbname="$DATABASE_URL"
echo "✓ Backup written: $DEST ($(du -h "$DEST" | cut -f1))"

find "$BACKUP_DIR" -name 'techno-store_*.dump' -mtime "+${RETENTION_DAYS}" -print -delete

if [ -n "${RCLONE_REMOTE:-}" ] && command -v rclone >/dev/null 2>&1; then
  rclone copy "$DEST" "$RCLONE_REMOTE" && echo "✓ Uploaded to $RCLONE_REMOTE"
elif [ -n "${RCLONE_REMOTE:-}" ]; then
  echo "✗ RCLONE_REMOTE is set but rclone is not installed — backup stayed local only" >&2
fi
