#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Magazine 2.0 — установка готового образа с GHCR в одну команду.
# Исходный код и сборка НЕ нужны: скрипт сам скачивает образ и всё настроит.
#
#   curl -fsSL https://raw.githubusercontent.com/vasdko4/universal-crm-ua/main/install.sh | bash
#
# Что делает на чистой виртуальной машине (Ubuntu/Debian):
#   0. Готовит ОС: пакеты, timezone Europe/Kyiv, swap на слабом VPS,
#      Docker + Compose, firewall (22/80/443, при необходимости 3000 и FTP)
#   1. Спрашивает домен (Enter — пропустить, будет http://IP:3000)
#   2. Генерирует .env с секретами и паролями (БД, FTP, auth)
#   3. Скачивает образ ghcr.io/vasdko4/universal-crm-ua:latest и запускает всё
#   4. При указанном домене поднимает Caddy с автоматическим HTTPS
#
# Неинтерактивно: DOMAIN=shop.example.com bash install.sh
# Другая версия:  IMAGE=ghcr.io/vasdko4/universal-crm-ua:2.0.0 bash install.sh
# Пропустить hardening ОС: SKIP_VM_SETUP=1 bash install.sh
#
# ПОЧЕМУ ghcr.io, А НЕ Docker Hub: release.yml (CI) публикует каждый
# релиз в GitHub Container Registry всегда; в Docker Hub — только если
# в секретах репозитория заданы DOCKERHUB_USERNAME/DOCKERHUB_TOKEN. Без
# них jastindle/magazineuakraine на Docker Hub просто не обновляется, и
# сервер годами тянет один и тот же старый образ, хотя `docker compose
# pull` не сообщает об этом никакой ошибкой. ghcr.io/vasdko4/... гарантированно
# в ногу с последним тегом версии.
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

IMAGE="${IMAGE:-ghcr.io/vasdko4/universal-crm-ua:latest}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/magazine}"
SKIP_VM_SETUP="${SKIP_VM_SETUP:-0}"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
say()  { printf "\n${CYAN}${BOLD}── %s${NC}\n" "$1"; }
ok()   { printf "${GREEN}✓ %s${NC}\n" "$1"; }
err()  { printf "${RED}✗ %s${NC}\n" "$1" >&2; }
warn() { printf "  ⚠ %s\n" "$1"; }

as_root() {
  if [ "$(id -u)" = "0" ]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    return 1
  fi
}

docker_bin() {
  if docker info >/dev/null 2>&1; then
    docker "$@"
  elif command -v sudo >/dev/null 2>&1 && sudo docker info >/dev/null 2>&1; then
    sudo docker "$@"
  else
    docker "$@"
  fi
}

# ── 0. Подготовка виртуальной машины ────────────────────────────────
harden_vm() {
  [ "$(uname -s)" = "Linux" ] || return 0
  [ "$SKIP_VM_SETUP" = "1" ] && { ok "SKIP_VM_SETUP=1 — подготовка ОС пропущена"; return 0; }

  say "Подготовка виртуальной машины"

  if ! as_root true >/dev/null 2>&1; then
    warn "Нет root/sudo — пропускаю пакеты, swap и firewall. Нужны Docker и Compose."
    return 0
  fi

  export DEBIAN_FRONTEND=noninteractive
  if command -v apt-get >/dev/null 2>&1; then
    as_root apt-get update -qq || true
    as_root apt-get install -y -qq curl ca-certificates gnupg openssl ufw >/dev/null || true
  fi

  if command -v timedatectl >/dev/null 2>&1; then
    as_root timedatectl set-timezone Europe/Kyiv >/dev/null 2>&1 || true
    ok "Часовой пояс: $(cat /etc/timezone 2>/dev/null || echo Europe/Kyiv)"
  fi

  if [ -r /proc/meminfo ]; then
    TOTAL_MEM_MB="$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)"
    SWAP_COUNT="$(swapon --show=NAME --noheadings 2>/dev/null | wc -l | tr -d ' ')"
    if [ "${SWAP_COUNT:-0}" -eq 0 ] && [ "${TOTAL_MEM_MB:-0}" -lt 4000 ]; then
      SWAP_FILE=/swapfile
      if [ ! -f "$SWAP_FILE" ]; then
        as_root fallocate -l 2G "$SWAP_FILE" 2>/dev/null \
          || as_root dd if=/dev/zero of="$SWAP_FILE" bs=1M count=2048 status=none
        as_root chmod 600 "$SWAP_FILE"
        as_root mkswap "$SWAP_FILE" >/dev/null
      fi
      as_root swapon "$SWAP_FILE" 2>/dev/null || true
      if [ -f /etc/fstab ] && ! grep -q "$SWAP_FILE" /etc/fstab; then
        echo "$SWAP_FILE none swap sw 0 0" | as_root tee -a /etc/fstab >/dev/null
      fi
      ok "Swap 2G ($SWAP_FILE) — RAM было ${TOTAL_MEM_MB}MB"
    else
      ok "Swap не нужен (RAM ${TOTAL_MEM_MB:-?}MB или swap уже есть)"
    fi
  fi

  if [ -d /etc/sysctl.d ]; then
    printf 'vm.swappiness=10\n' | as_root tee /etc/sysctl.d/99-magazine.conf >/dev/null
    as_root sysctl -p /etc/sysctl.d/99-magazine.conf >/dev/null 2>&1 || true
  fi

  if command -v apt-get >/dev/null 2>&1; then
    as_root apt-get install -y -qq unattended-upgrades >/dev/null 2>&1 || true
    as_root dpkg-reconfigure -f noninteractive unattended-upgrades >/dev/null 2>&1 || true
  fi

  if [ -d /etc/systemd/journald.conf.d ] || mkdir -p /tmp; then
    as_root mkdir -p /etc/systemd/journald.conf.d 2>/dev/null || true
    if [ -d /etc/systemd/journald.conf.d ]; then
      printf '[Journal]\nSystemMaxUse=200M\n' | as_root tee /etc/systemd/journald.conf.d/99-magazine.conf >/dev/null
    fi
  fi

  ok "ОС подготовлена"
}

open_firewall() {
  [ "$(uname -s)" = "Linux" ] || return 0
  command -v ufw >/dev/null 2>&1 || return 0
  as_root true >/dev/null 2>&1 || return 0

  say "Firewall (UFW)"
  as_root ufw allow OpenSSH >/dev/null 2>&1 || as_root ufw allow 22/tcp >/dev/null 2>&1 || true
  as_root ufw allow 80/tcp >/dev/null 2>&1 || true
  as_root ufw allow 443/tcp >/dev/null 2>&1 || true
  # Без домена магазин слушает :3000 на хосте.
  local domain_val=""
  if [ -f .env ]; then
    domain_val="$(grep -E '^DOMAIN=' .env | cut -d= -f2- || true)"
  fi
  domain_val="${domain_val:-${DOMAIN:-}}"
  if [ -z "$domain_val" ]; then
    as_root ufw allow 3000/tcp >/dev/null 2>&1 || true
  fi
  if [ -f .env ] && grep -qE '^FTP_PASSWORD=.+' .env; then
    as_root ufw allow 21/tcp >/dev/null 2>&1 || true
    as_root ufw allow 21000:21010/tcp >/dev/null 2>&1 || true
  fi
  as_root ufw --force enable >/dev/null 2>&1 || true
  ok "UFW: 22, 80, 443 открыты"
}

install_docker() {
  say "Проверка Docker"

  if ! command -v docker &>/dev/null; then
    if [ "$(uname -s)" != "Linux" ]; then
      err "Docker не найден!"
      echo "  Установите Docker: curl -fsSL https://get.docker.com | sh"
      exit 1
    fi
    say "Установка Docker (get.docker.com)"
    if ! as_root true >/dev/null 2>&1; then
      err "Для установки Docker нужен root или sudo."
      echo "  Установите Docker: curl -fsSL https://get.docker.com | sh"
      exit 1
    fi
    curl -fsSL https://get.docker.com | as_root sh
    if command -v systemctl &>/dev/null; then
      as_root systemctl enable --now docker || true
    fi
    if [ "$(id -u)" != "0" ] && command -v usermod >/dev/null 2>&1; then
      as_root usermod -aG docker "$USER" || true
    fi
    ok "Docker установлен"
  fi

  # Демон может подняться не сразу после enable --now.
  for i in $(seq 1 30); do
    if docker_bin info >/dev/null 2>&1; then
      break
    fi
    if [ "$i" -eq 30 ]; then
      err "Docker-демон не запущен (или нужен sudo / повторный вход в группу docker)."
      echo "  Попробуйте: sudo systemctl start docker"
      echo "  Если ставили Docker только что — выйдите из SSH и зайдите снова."
      exit 1
    fi
    sleep 1
  done

  if ! docker_bin compose version >/dev/null 2>&1; then
    err "Docker Compose не найден (нужен docker compose v2+)."
    echo "  На Ubuntu: sudo apt-get install -y docker-compose-plugin"
    exit 1
  fi
  ok "Docker готов"
}

harden_vm
install_docker

# ── 2. Каталог установки ────────────────────────────────────────────
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# ── 3. .env с доменом и секретами ───────────────────────────────────
say "Настройка окружения"

if [ ! -f .env ]; then
  # При `curl | bash` stdin занят пайпом — читаем ответ с терминала.
  if [ -z "${DOMAIN:-}" ] && [ -r /dev/tty ]; then
    echo ""
    echo "  Укажите домен, на котором будет работать магазин"
    echo "  (например: shop.example.com). Enter — пропустить (доступ по IP:3000)."
    read -r -p "  Домен: " DOMAIN < /dev/tty || DOMAIN=""
  fi
  DOMAIN="${DOMAIN:-}"
  DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN#http://}"; DOMAIN="${DOMAIN%/}"
  DOMAIN="${DOMAIN%%/*}"

  PUBLIC_IP="$(curl -fsS4 --max-time 5 https://api.ipify.org 2>/dev/null || true)"
  if [ -z "$PUBLIC_IP" ]; then
    PUBLIC_IP="$(curl -fsS4 --max-time 5 https://ifconfig.me 2>/dev/null || true)"
  fi
  if [ -z "$PUBLIC_IP" ]; then
    PUBLIC_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
  fi

  if [ -n "$DOMAIN" ]; then
    PUBLIC_URL="https://${DOMAIN}"
  elif [ -n "$PUBLIC_IP" ]; then
    PUBLIC_URL="http://${PUBLIC_IP}:3000"
  else
    PUBLIC_URL="http://localhost:3000"
  fi

  gen_secret()   { if command -v openssl &>/dev/null; then openssl rand -base64 32; else head -c 32 /dev/urandom | base64; fi; }
  gen_password() { if command -v openssl &>/dev/null; then openssl rand -hex 16; else head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n'; fi; }

  # FTP passive mode needs the server's real public IP, not the domain: most
  # domains are proxied (Cloudflare etc.), and FTP data connections can't
  # traverse an HTTP(S) reverse proxy the way the app's own traffic does.
  FTP_ADDRESS="$PUBLIC_IP"
  if [ -z "$FTP_ADDRESS" ]; then
    FTP_ADDRESS="$DOMAIN"
    [ -n "$DOMAIN" ] && warn "Не удалось определить публичный IP сервера — FTP_ADDRESS временно указывает на домен ${DOMAIN}. Если домен проксируется (например, через Cloudflare), FTP не будет работать: замените FTP_ADDRESS в .env на реальный IP сервера и перезапустите контейнер ftp."
  fi

  cat > .env <<ENVEOF
# Сгенерировано автоматически скриптом install.sh (Magazine 2.0)
BETTER_AUTH_URL=${PUBLIC_URL}
NEXT_PUBLIC_SITE_URL=${PUBLIC_URL}
BETTER_AUTH_SECRET=$(gen_secret)
CRON_SECRET=$(gen_secret)
POSTGRES_PASSWORD=$(gen_password)
FTP_USER=techno
FTP_PASSWORD=$(gen_password)
FTP_ADDRESS=${FTP_ADDRESS}
DOMAIN=${DOMAIN}
UPDATER_SECRET=$(gen_secret)
COMPOSE_PROJECT_NAME=magazine
ENVEOF
  chmod 600 .env
  ok "Файл .env создан: адрес ${PUBLIC_URL}, секреты и пароли сгенерированы"
else
  ok "Файл .env уже существует — используем его"
fi

# Sidecar for one-click updates from /admin/updates. install.sh does not
# clone the repo, so write updater.py next to the generated compose file.
mkdir -p scripts
cat > scripts/updater.py <<'PYEOF'
#!/usr/bin/env python3
import os
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SECRET = os.environ.get("UPDATER_SECRET", "")
PORT = int(os.environ.get("PORT", "8787"))
BIND_HOST = os.environ.get("BIND_HOST", "127.0.0.1")
COMPOSE_FILE = os.environ.get("COMPOSE_FILE", "/workspace/docker-compose.yml")
PROJECT_DIR = os.environ.get("COMPOSE_PROJECT_DIR", "/workspace")
SERVICE = os.environ.get("APP_SERVICE", "app")
COMPOSE_BASE = ["docker", "compose", "-f", COMPOSE_FILE, "--project-directory", PROJECT_DIR]
_lock = threading.Lock()
_running = False

def run_update() -> None:
    global _running
    with _lock:
        if _running:
            return
        _running = True
    try:
        subprocess.run(COMPOSE_BASE + ["pull", SERVICE], check=False)
        subprocess.run(COMPOSE_BASE + ["up", "-d", SERVICE], check=False)
    finally:
        with _lock:
            _running = False

class Handler(BaseHTTPRequestHandler):
    def _json(self, code: int, body: bytes) -> None:
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body)
    def do_GET(self) -> None:
        self._json(200 if self.path == "/health" else 404, b'{"status":"ok"}' if self.path == "/health" else b'{"error":"not_found"}')
    def do_POST(self) -> None:
        if self.path != "/update":
            self._json(404, b'{"error":"not_found"}')
            return
        if not SECRET:
            self._json(503, b'{"error":"not_configured"}')
            return
        if self.headers.get("X-Updater-Secret") != SECRET:
            self._json(401, b'{"error":"unauthorized"}')
            return
        threading.Thread(target=run_update, daemon=True).start()
        self._json(202, b'{"status":"started"}')
    def log_message(self, fmt: str, *args) -> None:
        print("[updater] " + (fmt % args), flush=True)

if __name__ == "__main__":
    ThreadingHTTPServer((BIND_HOST, PORT), Handler).serve_forever()
PYEOF

# ── 4. docker-compose.yml (образ с GHCR, без сборки) ────────────────
cat > docker-compose.yml <<COMPOSEEOF
services:
  db:
    image: postgres:16-alpine
    container_name: magazine-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: techno
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-techno}
      POSTGRES_DB: magazine
    volumes:
      - magazine_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U techno -d magazine"]
      interval: 3s
      timeout: 3s
      retries: 20

  app:
    image: ${IMAGE}
    container_name: magazine-app
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "3000:3000"
    volumes:
      - magazine_uploads:/app/public/uploads
    environment:
      DATABASE_URL: postgres://techno:\${POSTGRES_PASSWORD:-techno}@db:5432/magazine
      BETTER_AUTH_SECRET: \${BETTER_AUTH_SECRET:?set BETTER_AUTH_SECRET in .env}
      BETTER_AUTH_URL: \${BETTER_AUTH_URL:-http://localhost:3000}
      CRON_SECRET: \${CRON_SECRET:-}
      NEXT_PUBLIC_SITE_URL: \${NEXT_PUBLIC_SITE_URL:-}
      UPDATER_URL: \${UPDATER_URL:-http://updater:8787}
      UPDATER_SECRET: \${UPDATER_SECRET:-}
    command: >
      sh -c "node scripts/db-setup.mjs && node server.js"
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 10s
      timeout: 5s
      retries: 18
      start_period: 40s

  updater:
    image: python:3.12-alpine
    container_name: magazine-updater
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - .:/workspace:ro
    working_dir: /workspace
    environment:
      UPDATER_SECRET: \${UPDATER_SECRET:-}
      COMPOSE_PROJECT_NAME: \${COMPOSE_PROJECT_NAME:-magazine}
      BIND_HOST: "0.0.0.0"
    command: >
      sh -c "apk add --no-cache docker-cli docker-cli-compose >/dev/null 2>&1 && python3 scripts/updater.py"

  ftp:
    image: delfer/alpine-ftp-server:latest
    container_name: magazine-ftp
    restart: unless-stopped
    profiles: ["ftp"]
    ports:
      - "21:21"
      - "21000-21010:21000-21010"
    environment:
      USERS: "\${FTP_USER:-techno}|\${FTP_PASSWORD:-}|/ftp/uploads"
      ADDRESS: \${FTP_ADDRESS:-}
      MIN_PORT: "21000"
      MAX_PORT: "21010"
    volumes:
      - magazine_uploads:/ftp/uploads

  caddy:
    image: caddy:2-alpine
    container_name: magazine-caddy
    restart: unless-stopped
    profiles: ["proxy"]
    ports:
      - "80:80"
      - "443:443"
    command: caddy reverse-proxy --from \${DOMAIN:?set DOMAIN in .env to use the proxy} --to app:3000
    depends_on:
      - app
    volumes:
      - magazine_caddy_data:/data
      - magazine_caddy_config:/config

volumes:
  magazine_pgdata:
  magazine_uploads:
  magazine_caddy_data:
  magazine_caddy_config:
COMPOSEEOF
ok "docker-compose.yml создан (образ: ${IMAGE})"

open_firewall

# ── 5. Запуск ───────────────────────────────────────────────────────
say "Скачивание образа и запуск (1-3 минуты)"

PROFILES=""
grep -qE '^FTP_PASSWORD=.+' .env 2>/dev/null && PROFILES="ftp"
# DOMAIN= (пустое) не должно включать Caddy — иначе контейнер падает на ${DOMAIN:?...}
if grep -qE '^DOMAIN=[^[:space:]]+' .env 2>/dev/null; then
  PROFILES="${PROFILES:+${PROFILES},}proxy"
fi

set +e
COMPOSE_PROFILES="$PROFILES" docker_bin compose pull
PULL_RC=$?
COMPOSE_PROFILES="$PROFILES" docker_bin compose up -d
UP_RC=$?
set -e
if [ "$PULL_RC" -ne 0 ] || [ "$UP_RC" -ne 0 ]; then
  err "Не удалось скачать образ или запустить контейнеры (pull=$PULL_RC up=$UP_RC)."
  docker_bin compose logs --tail=80 app db || true
  exit 1
fi

printf "Ожидание готовности"
READY=0
for i in $(seq 1 90); do
  if curl -sf http://127.0.0.1:3000/api/health &>/dev/null; then
    printf '\n'; ok "Приложение готово!"; READY=1; break
  fi
  printf '.'
  sleep 3
done
if [ "$READY" != "1" ]; then
  printf '\n'
  err "Превышено время ожидания. Логи:"
  docker_bin compose logs --tail=80 app db || true
  exit 1
fi

# ── Итог ────────────────────────────────────────────────────────────
SITE_URL="$(grep -E '^BETTER_AUTH_URL=' .env | cut -d= -f2- || true)"
SITE_URL="${SITE_URL:-http://localhost:3000}"
FTP_USER_SHOW="$(grep -E '^FTP_USER=' .env | cut -d= -f2- || true)"
FTP_PASS_SHOW="$(grep -E '^FTP_PASSWORD=' .env | cut -d= -f2- || true)"
DOMAIN_SHOW="$(grep -E '^DOMAIN=' .env | cut -d= -f2- || true)"
echo ""
printf "${GREEN}${BOLD}"
echo "  ╔═══════════════════════════════════════════════╗"
echo "  ║       🎉 МАГАЗИН 2.0 УСПЕШНО УСТАНОВЛЕН! 🎉      ║"
echo "  ╚═══════════════════════════════════════════════╝"
printf "${NC}"
echo ""
echo "  Откройте:  ${SITE_URL}"
echo ""
echo "  При первом заходе вас автоматически перенаправит на мастер"
echo "  установки — там вы создадите магазин и admin-логин/пароль."
if [ -n "${DOMAIN_SHOW}" ]; then
  echo ""
  echo "  HTTPS: встроенный прокси Caddy сам получит SSL-сертификат"
  echo "  Let's Encrypt для ${DOMAIN_SHOW} (nginx настраивать не нужно)."
  echo "  Убедитесь, что A-запись домена указывает на IP этого сервера"
  echo "  и порты 80/443 открыты."
fi
if [ -n "${FTP_PASS_SHOW}" ]; then
  echo ""
  echo "  FTP-доступ к загрузкам (фото товаров):"
  echo "    Пользователь: ${FTP_USER_SHOW:-techno}"
  echo "    Пароль:       ${FTP_PASS_SHOW}"
fi
echo ""
echo "  Файлы установки: ${INSTALL_DIR} (пароли — в .env, не удаляйте его)."
echo "  Данные (БД + загрузки) — в Docker-томах на этой машине."
echo ""
echo "  Полезные команды (выполнять из ${INSTALL_DIR}):"
echo "    docker compose logs -f app   — логи приложения"
echo "    docker compose down          — остановить"
echo "    docker compose pull && docker compose up -d  — обновить версию"
echo ""
