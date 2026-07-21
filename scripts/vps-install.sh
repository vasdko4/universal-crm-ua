#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Techno Store — production install on a clean Ubuntu/Debian VPS.
#
# Usage (run as root from the project directory on the server):
#
#   bash scripts/vps-install.sh                # install with IP only
#   DOMAIN=shop.example.com bash scripts/vps-install.sh   # with a domain
#
# What it does:
#   1. Installs Node.js 22, pnpm, PostgreSQL, nginx
#   2. Creates a Postgres database and applies db/schema.sql (empty store —
#      configure it via the web setup wizard on first visit)
#   3. Generates .env.production with secure secrets
#   4. Builds the app and registers a systemd service (auto-restart, boot)
#   5. Configures nginx as a reverse proxy on port 80
#   6. Enables the UFW firewall (22, 80, 443 only)
#
# Safe to re-run: every step is idempotent.
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

say() { printf '\n\033[1;36m── %s\033[0m\n' "$1"; }
ok()  { printf '\033[1;32m✓ %s\033[0m\n' "$1"; }
err() { printf '\033[1;31m✗ %s\033[0m\n' "$1" >&2; }

[ "$(id -u)" = "0" ] || { err "Run as root: sudo bash scripts/vps-install.sh"; exit 1; }

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"
[ -f package.json ] || { err "package.json not found — run from the project directory"; exit 1; }

SERVER_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
PUBLIC_URL="http://${DOMAIN:-$SERVER_IP}"
DB_NAME="techno_store"
DB_USER="techno"

# ── 0. Swap (weak VPS survival) ──────────────────────────────────────
# `pnpm build` on this app can need 1.5-2GB+ of memory. A 1-2GB-RAM VPS with
# no swap gets OOM-killed mid-build with a bare "Killed" message and no other
# clue. A modest swapfile prevents that at the cost of a bit of disk I/O.
say "Checking swap"
TOTAL_MEM_MB="$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)"
if [ "$(swapon --show=NAME --noheadings | wc -l)" -eq 0 ] && [ "${TOTAL_MEM_MB:-0}" -lt 4000 ]; then
  SWAP_FILE=/swapfile
  if [ ! -f "$SWAP_FILE" ]; then
    fallocate -l 2G "$SWAP_FILE" 2>/dev/null || dd if=/dev/zero of="$SWAP_FILE" bs=1M count=2048 status=none
    chmod 600 "$SWAP_FILE"
    mkswap "$SWAP_FILE" >/dev/null
  fi
  swapon "$SWAP_FILE"
  grep -q "$SWAP_FILE" /etc/fstab || echo "$SWAP_FILE none swap sw 0 0" >> /etc/fstab
  ok "Added 2G swapfile ($SWAP_FILE) — RAM was ${TOTAL_MEM_MB}MB"
else
  ok "Swap already present or enough RAM (${TOTAL_MEM_MB}MB) — skipping"
fi

# ── 1. System packages ──────────────────────────────────────────────
say "Installing system packages (Node.js 22, PostgreSQL, nginx)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg ufw nginx postgresql postgresql-contrib >/dev/null

if ! command -v node >/dev/null || [ "$(node -v | cut -c2-3)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
ok "Node $(node -v)"

command -v pnpm >/dev/null || { corepack enable && corepack prepare pnpm@latest --activate; }
ok "pnpm $(pnpm -v)"

# ── 2. PostgreSQL ───────────────────────────────────────────────────
say "Configuring PostgreSQL"
systemctl enable --now postgresql >/dev/null 2>&1

DB_PASS_FILE="/root/.techno_db_pass"
if [ ! -f "$DB_PASS_FILE" ]; then
  openssl rand -hex 24 > "$DB_PASS_FILE"
  chmod 600 "$DB_PASS_FILE"
fi
DB_PASS="$(cat "$DB_PASS_FILE")"

sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}'" >/dev/null
sudo -u postgres psql -c "ALTER ROLE ${DB_USER} PASSWORD '${DB_PASS}'" >/dev/null

if ! sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
  ok "Database ${DB_NAME} created"
  say "Applying database schema (db/schema.sql)"
  sudo -u postgres psql -d "$DB_NAME" -q -f db/schema.sql >/dev/null
  sudo -u postgres psql -d "$DB_NAME" -q -c "
    GRANT ALL ON ALL TABLES IN SCHEMA public TO ${DB_USER};
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};" >/dev/null
  ok "Schema applied — the store is configured via the web setup wizard on first visit"
else
  ok "Database ${DB_NAME} already exists — keeping data"
fi

# ── 3. Environment ──────────────────────────────────────────────────
say "Writing .env.production"
if [ ! -f .env.production ]; then
  AUTH_SECRET="$(openssl rand -base64 32)"
  # Protects /api/cron/delivery-sync: without it that endpoint answers any
  # unauthenticated caller (hits the Nova Poshta API, writes to the DB, can
  # email customers). Since this VPS install doesn't wire up a systemd timer
  # for it, set one up yourself (crontab/systemd) sending this same secret
  # as "Authorization: Bearer <CRON_SECRET>" if you want the sync to run.
  DELIVERY_CRON_SECRET="$(openssl rand -base64 32)"
  cat > .env.production <<ENV
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}
BETTER_AUTH_SECRET=${AUTH_SECRET}
BETTER_AUTH_URL=${PUBLIC_URL}
CRON_SECRET=${DELIVERY_CRON_SECRET}
NODE_ENV=production
ENV
  chmod 600 .env.production
  ok ".env.production created"
else
  ok ".env.production already exists — keeping it"
fi

# ── 4. Build ────────────────────────────────────────────────────────
say "Installing dependencies and building (this takes a few minutes)"
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
set -a; . ./.env.production; set +a
pnpm build
ok "Build finished"

# ── 5. systemd service ──────────────────────────────────────────────
say "Registering systemd service"
cat > /etc/systemd/system/techno-store.service <<UNIT
[Unit]
Description=Techno Store (Next.js)
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env.production
ExecStart=$(command -v pnpm) start
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now techno-store >/dev/null
ok "Service techno-store started"

# ── 5b. Automated daily DB backup ───────────────────────────────────
# Local-disk-only, but still far better than the previous "no backup at all".
# For a store with real orders/customers, also set RCLONE_REMOTE (see
# scripts/db-backup.sh) so backups leave this server -- a disk failure or a
# bad rm shouldn't be able to destroy both the live DB and its backups.
say "Setting up daily DB backup (systemd timer)"
chmod +x scripts/db-backup.sh
cat > /etc/systemd/system/techno-store-backup.service <<UNIT
[Unit]
Description=Techno Store backup DB
After=postgresql.service

[Service]
Type=oneshot
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env.production
ExecStart=${APP_DIR}/scripts/db-backup.sh
UNIT
cat > /etc/systemd/system/techno-store-backup.timer <<TIMER
[Unit]
Description=Run techno-store-backup daily

[Timer]
OnCalendar=*-*-* 03:30:00
RandomizedDelaySec=600
Persistent=true

[Install]
WantedBy=timers.target
TIMER
systemctl daemon-reload
systemctl enable --now techno-store-backup.timer >/dev/null
ok "Daily backup timer enabled (03:30 UTC, /var/backups/techno-store)"

# ── 6. nginx ────────────────────────────────────────────────────────
say "Configuring nginx"
cat > /etc/nginx/sites-available/techno-store <<NGINX
# If a TLS-terminating proxy (Cloudflare, another nginx, etc.) sits in front
# of this server, keep ITS X-Forwarded-Proto (https) instead of overwriting
# it with our local scheme (http). Auth cookies depend on the correct proto.
map \$http_x_forwarded_proto \$fwd_proto {
    default \$http_x_forwarded_proto;
    ""      \$scheme;
}

server {
    listen 80 default_server;
    server_name ${DOMAIN:-_};
    client_max_body_size 25m;

    # Compress text responses — meaningfully cuts bandwidth/CPU-per-byte on a
    # constrained VPS uplink. gzip_comp_level 5 is a good CPU/ratio tradeoff
    # for weak CPUs (6+ barely improves ratio but costs much more CPU).
    gzip on;
    gzip_comp_level 5;
    gzip_min_length 512;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml application/json application/javascript application/xml+rss image/svg+xml;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$fwd_proto;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 120s;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/techno-store /etc/nginx/sites-enabled/techno-store
rm -f /etc/nginx/sites-enabled/default
nginx -t >/dev/null && systemctl reload nginx
ok "nginx proxies :80 → :3000"

# ── 7. Firewall ─────────────────────────────────────────────────────
say "Enabling firewall (22, 80, 443)"
ufw allow 22/tcp >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
ok "UFW active"

# ── Done ────────────────────────────────────────────────────────────
say "Installation complete!"
echo "  Store:        ${PUBLIC_URL}"
echo "  Admin panel:  ${PUBLIC_URL}/admin"
echo ""
echo "  Service:      systemctl status techno-store"
echo "  Logs:         journalctl -u techno-store -f"
echo "  DB password:  ${DB_PASS_FILE}"
if [ -n "${DOMAIN:-}" ]; then
  echo ""
  echo "  HTTPS: apt install certbot python3-certbot-nginx && certbot --nginx -d ${DOMAIN}"
fi
