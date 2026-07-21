#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Techno Store — установка готового образа с Docker Hub в одну команду.
# Исходный код и сборка НЕ нужны: скрипт сам скачает образ и всё настроит.
#
#   curl -fsSL https://raw.githubusercontent.com/vasdko4/techno-store/main/install.sh | bash
#
# Что делает:
#   1. Проверяет Docker (на Linux предложит установить автоматически)
#   2. Спрашивает домен (Enter — пропустить, будет http://IP:3000)
#   3. Генерирует .env с секретами и паролями (БД, FTP, auth)
#   4. Скачивает образ jastindle/magazineuakraine:latest и запускает всё
#   5. При указанном домене поднимает Caddy с автоматическим HTTPS
#
# Неинтерактивно: DOMAIN=shop.example.com bash install.sh
# Другая версия:  IMAGE=jastindle/magazineuakraine:1.2.0 bash install.sh
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

IMAGE="${IMAGE:-jastindle/magazineuakraine:latest}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/techno-store}"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
say()  { printf "\n${CYAN}${BOLD}── %s${NC}\n" "$1"; }
ok()   { printf "${GREEN}✓ %s${NC}\n" "$1"; }
err()  { printf "${RED}✗ %s${NC}\n" "$1" >&2; }

# ── 1. Docker ────────────────────────────────────────────────────────
say "Проверка Docker"

if ! command -v docker &>/dev/null; then
  err "Docker не найден!"
  if [ "$(uname -s)" = "Linux" ] && [ -r /dev/tty ]; then
    read -r -p "  Установить Docker автоматически? [Y/n] " REPLY_DOCKER < /dev/tty || REPLY_DOCKER="y"
    case "${REPLY_DOCKER:-y}" in
      [Yy]*|"")
        say "Установка Docker (get.docker.com)"
        curl -fsSL https://get.docker.com | sh
        command -v systemctl &>/dev/null && systemctl enable --now docker || true
        ok "Docker установлен"
        ;;
      *) exit 1 ;;
    esac
  else
    echo "  Установите Docker: curl -fsSL https://get.docker.com | sh"
    exit 1
  fi
fi

if ! docker info &>/dev/null; then
  err "Docker демон не запущен (или нужен sudo). Запустите службу docker."
  exit 1
fi
if ! docker compose version &>/dev/null; then
  err "Docker Compose не найден (нужен docker compose v2+)."
  exit 1
fi
ok "Docker готов"

# ── 2. Каталог установки ─────────────────────────────────────────────
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# ── 3. .env с доменом и секретами ────────────────────────────────────
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
  if [ -n "$DOMAIN" ]; then
    PUBLIC_URL="https://${DOMAIN}"
  else
    PUBLIC_URL="http://localhost:3000"
  fi

  gen_secret()   { if command -v openssl &>/dev/null; then openssl rand -base64 32; else head -c 32 /dev/urandom | base64; fi; }
  gen_password() { if command -v openssl &>/dev/null; then openssl rand -hex 16; else head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n'; fi; }

  cat > .env <<ENVEOF
# Сгенерировано автоматически скриптом install.sh
BETTER_AUTH_URL=${PUBLIC_URL}
NEXT_PUBLIC_SITE_URL=${PUBLIC_URL}
BETTER_AUTH_SECRET=$(gen_secret)
CRON_SECRET=$(gen_secret)
POSTGRES_PASSWORD=$(gen_password)
FTP_USER=techno
FTP_PASSWORD=$(gen_password)
FTP_ADDRESS=${DOMAIN}
DOMAIN=${DOMAIN}
ENVEOF
  chmod 600 .env
  ok "Файл .env создан: адрес ${PUBLIC_URL}, секреты и пароли сгенерированы"
else
  ok "Файл .env уже существует — используем его"
fi

# ── 4. docker-compose.yml (образ с Docker Hub, без сборки) ──────────
cat > docker-compose.yml <<COMPOSEEOF
services:
  db:
    image: postgres:16-alpine
    container_name: techno-store-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: techno
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-techno}
      POSTGRES_DB: techno_store
    volumes:
      - techno_store_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U techno -d techno_store"]
      interval: 3s
      timeout: 3s
      retries: 20

  app:
    image: ${IMAGE}
    container_name: techno-store-app
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "3000:3000"
    volumes:
      - techno_store_uploads:/app/public/uploads
    environment:
      DATABASE_URL: postgres://techno:\${POSTGRES_PASSWORD:-techno}@db:5432/techno_store
      BETTER_AUTH_SECRET: \${BETTER_AUTH_SECRET:?set BETTER_AUTH_SECRET in .env}
      BETTER_AUTH_URL: \${BETTER_AUTH_URL:-http://localhost:3000}
      CRON_SECRET: \${CRON_SECRET:-}
      NEXT_PUBLIC_SITE_URL: \${NEXT_PUBLIC_SITE_URL:-}
    command: >
      sh -c "node scripts/db-setup.mjs && node server.js"

  ftp:
    image: delfer/alpine-ftp-server:latest
    container_name: techno-store-ftp
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
      - techno_store_uploads:/ftp/uploads

  caddy:
    image: caddy:2-alpine
    container_name: techno-store-caddy
    restart: unless-stopped
    profiles: ["proxy"]
    ports:
      - "80:80"
      - "443:443"
    command: caddy reverse-proxy --from \${DOMAIN:?set DOMAIN in .env to use the proxy} --to app:3000
    depends_on:
      - app
    volumes:
      - techno_store_caddy_data:/data
      - techno_store_caddy_config:/config

volumes:
  techno_store_pgdata:
  techno_store_uploads:
  techno_store_caddy_data:
  techno_store_caddy_config:
COMPOSEEOF
ok "docker-compose.yml создан (образ: ${IMAGE})"

# ── 5. Запуск ────────────────────────────────────────────────────────
say "Скачивание образа и запуск (1-3 минуты)"

PROFILES=""
grep -qE '^FTP_PASSWORD=.+' .env 2>/dev/null && PROFILES="ftp"
grep -qE '^DOMAIN=.+' .env 2>/dev/null && PROFILES="${PROFILES:+${PROFILES},}proxy"

COMPOSE_PROFILES="$PROFILES" docker compose pull 2>&1 | tail -3
COMPOSE_PROFILES="$PROFILES" docker compose up -d 2>&1 | tail -5

printf "Ожидание готовности"
for i in $(seq 1 60); do
  if curl -sf http://localhost:3000/api/health &>/dev/null; then
    printf '\n'; ok "Приложение готово!"; break
  fi
  if [ "$i" -eq 60 ]; then
    printf '\n'; err "Превышено время ожидания. Логи: docker compose logs app"; exit 1
  fi
  printf '.'; sleep 2
done

# ── Итог ─────────────────────────────────────────────────────────────
SITE_URL="$(grep -E '^BETTER_AUTH_URL=' .env | cut -d= -f2- || true)"
SITE_URL="${SITE_URL:-http://localhost:3000}"
FTP_USER_SHOW="$(grep -E '^FTP_USER=' .env | cut -d= -f2- || true)"
FTP_PASS_SHOW="$(grep -E '^FTP_PASSWORD=' .env | cut -d= -f2- || true)"
DOMAIN_SHOW="$(grep -E '^DOMAIN=' .env | cut -d= -f2- || true)"
echo ""
printf "${GREEN}${BOLD}"
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║       🎉 МАГАЗИН УСПЕШНО УСТАНОВЛЕН! 🎉      ║"
echo "  ╚══════════════════════════════════════════════╝"
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
