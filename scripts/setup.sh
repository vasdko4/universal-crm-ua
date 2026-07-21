#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Techno Store — one-command local setup.
#
#   bash scripts/setup.sh
#
# What it does (default — clean-server install of the FULL current store):
#   1. Creates .env.local (with a generated BETTER_AUTH_SECRET) if missing
#   2. Installs npm dependencies with pnpm
#   3. Starts a local Postgres via Docker (docker compose)
#   4. Restores the FULL current-store snapshot from db/dump.sql — schema + ALL
#      current data (100+ products, categories, galleries, articles, orders,
#      settings, admin account). An exact copy of the live demo, ready to run.
#
# Flags:
#   --schema   Apply ONLY the empty schema and configure via the web wizard.
#   --seed     Apply schema + the built-in demo seed (instead of the snapshot).
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."

say() { printf '\n\033[1;36m%s\033[0m\n' "$1"; }
ok()  { printf '\033[1;32m✓ %s\033[0m\n' "$1"; }
err() { printf '\033[1;31m✗ %s\033[0m\n' "$1" >&2; }

# ── 1. Prerequisites ────────────────────────────────────────────────
command -v node >/dev/null || { err "Node.js is required (v20+)."; exit 1; }

if ! command -v pnpm >/dev/null; then
  say "pnpm not found — enabling via corepack"
  corepack enable && corepack prepare pnpm@latest --activate
fi

# ── 2. Environment file ─────────────────────────────────────────────
if [ ! -f .env.local ]; then
  say "Creating .env.local"
  cp .env.example .env.local
  if command -v openssl >/dev/null; then
    SECRET="$(openssl rand -base64 32)"
    CRON_SECRET_VAL="$(openssl rand -base64 32)"
    # Portable in-place sed (works on both GNU and BSD/macOS sed).
    # .env.example has two "replace-me-..." placeholders (BETTER_AUTH_SECRET,
    # CRON_SECRET) — replace them one at a time, first match each.
    sed -i.bak "0,/replace-me-with-openssl-rand-base64-32/s##${SECRET}#" .env.local && rm -f .env.local.bak
    sed -i.bak "0,/replace-me-with-openssl-rand-base64-32/s##${CRON_SECRET_VAL}#" .env.local && rm -f .env.local.bak
    ok "Generated BETTER_AUTH_SECRET and CRON_SECRET"
  else
    err "openssl not found — set BETTER_AUTH_SECRET and CRON_SECRET in .env.local manually."
  fi
else
  ok ".env.local already exists — keeping it"
fi

# ── 3. Dependencies ─────────────────────────────────────────────────
say "Installing dependencies"
pnpm install

# ── 4. Database ─────────────────────────────────────────────────────
# docker-compose.yml maps host port 5433 -> container 5432 with these creds.
DOCKER_DB_URL="postgres://techno:techno@localhost:5433/techno_store"

if command -v docker >/dev/null && docker compose version >/dev/null 2>&1; then
  say "Starting Postgres (docker compose)"
  docker compose up -d db
  printf 'Waiting for Postgres to be ready'
  for _ in $(seq 1 30); do
    if docker compose exec -T db pg_isready -U techno -d techno_store >/dev/null 2>&1; then
      printf '\n'; ok "Postgres is ready"; break
    fi
    printf '.'; sleep 1
  done

  # Point .env.local at the Docker database if DATABASE_URL is still empty.
  # Without this the db:restore/db:setup step below aborts with
  # "DATABASE_URL is not set" on a clean machine.
  if grep -Eq '^DATABASE_URL=("")?$' .env.local; then
    sed -i.bak "s#^DATABASE_URL=.*#DATABASE_URL=\"${DOCKER_DB_URL}\"#" .env.local && rm -f .env.local.bak
    ok "Set DATABASE_URL to the Docker Postgres (localhost:5433)"
  fi
else
  err "Docker not found — skipping DB container."
  echo "  Point DATABASE_URL in .env.local at your own Postgres, then run:"
  echo "  pnpm db:setup"
fi

SCHEMA_ONLY=""
SEED_FLAG=""
for arg in "$@"; do
  [ "$arg" = "--schema" ] && SCHEMA_ONLY="1"
  [ "$arg" = "--seed" ] && SEED_FLAG="--seed"
done

if [ -n "$SCHEMA_ONLY" ]; then
  say "Applying database schema (empty — configure via the web wizard)"
  node --env-file=.env.local scripts/db-setup.mjs
elif [ -n "$SEED_FLAG" ]; then
  say "Applying schema + demo seed"
  node --env-file=.env.local scripts/db-setup.mjs --seed
else
  # Default: full snapshot of the current store (schema + ALL current data).
  say "Restoring full current-store snapshot (db/dump.sql)"
  node --env-file=.env.local scripts/db-restore.mjs --reset
fi

say "Setup complete!"
echo "  Start the app with:  pnpm dev"
echo "  Storefront:          http://localhost:3000"
if [ -n "$SCHEMA_ONLY" ]; then
  echo "  On first visit you'll see the setup wizard to create your admin account."
else
  echo "  Admin panel:         http://localhost:3000/admin"
  echo "  Admin login:         admin@techno.store  /  Admin12345"
fi
