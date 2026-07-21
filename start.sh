#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Techno Store — запуск в одну команду через Docker
#
# Использование:
#   chmod +x start.sh
#   ./start.sh
#
# Скрипт полностью автоматический:
#   1. Проверяет что Docker установлен и запущен
#   2. Генерирует .env файл с безопасными секретами (если не существует)
#   3. Собирает и запускает приложение + базу данных
#   4. Применяет схему БД и загружает данные магазина
#
# Для остановки:  docker compose down
# Для удаления данных: docker compose down -v
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

say()  { printf "\n${CYAN}${BOLD}── %s${NC}\n" "$1"; }
ok()   { printf "${GREEN}✓ %s${NC}\n" "$1"; }
err()  { printf "${RED}✗ %s${NC}\n" "$1" >&2; }
info() { printf "  %s\n" "$1"; }

cd "$(dirname "$0")"

# ── 1. Prerequisites ────────────────────────────────────────────────
say "Проверка Docker"

if ! command -v docker &>/dev/null; then
  err "Docker не найден!"
  if [ "$(uname -s)" = "Linux" ] && [ -t 0 ]; then
    read -r -p "  Установить Docker автоматически? [Y/n] " REPLY_DOCKER
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
    echo ""
    echo "  Установите Docker:"
    echo "    • Linux:  curl -fsSL https://get.docker.com | sh"
    echo "    • macOS:  https://docs.docker.com/desktop/mac/install/"
    echo "    • Windows: https://docs.docker.com/desktop/windows/install/"
    echo ""
    exit 1
  fi
fi

if ! docker info &>/dev/null; then
  err "Docker демон не запущен. Запустите Docker Desktop или службу docker."
  exit 1
fi

if ! docker compose version &>/dev/null; then
  err "Docker Compose не найден (нужен docker compose v2+)."
  exit 1
fi

ok "Docker $(docker --version | grep -oP '\d+\.\d+\.\d+') готов"

# ── 2. Environment file ─────────────────────────────────────────────
say "Настройка окружения"

if [ ! -f .env ]; then
  # ── Domain ─────────────────────────────────────────────────────────
  # The domain configures Better Auth callbacks AND storefront SEO
  # (canonical links, sitemap.xml, robots.txt, OG tags). It can be passed
  # non-interactively: DOMAIN=shop.example.com ./start.sh
  if [ -z "${DOMAIN:-}" ] && [ -t 0 ]; then
    echo ""
    echo "  Укажите домен, на котором будет работать магазин"
    echo "  (например: shop.example.com). Оставьте пустым для localhost."
    read -r -p "  Домен: " DOMAIN || DOMAIN=""
  fi
  DOMAIN="${DOMAIN:-}"
  # Strip protocol/trailing slash if the user pasted a full URL.
  DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN#http://}"; DOMAIN="${DOMAIN%/}"
  if [ -n "$DOMAIN" ]; then
    PUBLIC_URL="https://${DOMAIN}"
  else
    PUBLIC_URL="http://localhost:3000"
  fi

  # ── Secrets ────────────────────────────────────────────────────────
  gen_secret() {
    if command -v openssl &>/dev/null; then openssl rand -base64 32; else head -c 32 /dev/urandom | base64; fi
  }
  gen_password() {
    if command -v openssl &>/dev/null; then openssl rand -hex 16; else head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n'; fi
  }
  AUTH_SECRET=$(gen_secret)
  CRON_SECRET_VAL=$(gen_secret)
  DB_PASSWORD=$(gen_password)
  FTP_USER_VAL="techno"
  FTP_PASSWORD_VAL=$(gen_password)

  cat > .env <<ENVEOF
# Сгенерировано автоматически скриптом start.sh
# Не редактируйте вручную, если не знаете что делаете.

# Публичный адрес магазина (авторизация + SEO: canonical, sitemap, robots).
BETTER_AUTH_URL=${PUBLIC_URL}
NEXT_PUBLIC_SITE_URL=${PUBLIC_URL}

# Секреты (сгенерированы автоматически).
BETTER_AUTH_SECRET=${AUTH_SECRET}
CRON_SECRET=${CRON_SECRET_VAL}

# Пользователь БД: techno / пароль ниже (создаётся при первом запуске).
POSTGRES_PASSWORD=${DB_PASSWORD}

# FTP-доступ к папке загрузок (фото товаров): порт 21, пассивные 21000-21010.
FTP_USER=${FTP_USER_VAL}
FTP_PASSWORD=${FTP_PASSWORD_VAL}
# Для доступа к FTP извне укажите внешний IP или домен сервера:
FTP_ADDRESS=${DOMAIN}

# Домен магазина. Если указан — запускается встроенный реверс-прокси Caddy:
# он сам получает и продлевает SSL-сертификат Let's Encrypt (nginx не нужен).
DOMAIN=${DOMAIN}
ENVEOF
  chmod 600 .env
  ok "Файл .env создан: адрес ${PUBLIC_URL}, секреты и пароли сгенерированы"
else
  ok "Файл .env уже существует — используем его"
fi

# ── 3. Build & Start ────────────────────────────────────────────────
say "Запуск контейнеров (первая сборка может занять 2-5 минут)"

# Optional services are enabled by what's in .env:
#   • ftp   — only when FTP credentials exist (fresh installs);
#   • proxy — Caddy with automatic HTTPS, only when a domain is set.
# Older .env files without these values keep working without the services.
PROFILES=""
if grep -qE '^FTP_PASSWORD=.+' .env 2>/dev/null; then
  PROFILES="ftp"
fi
if grep -qE '^DOMAIN=.+' .env 2>/dev/null; then
  PROFILES="${PROFILES:+${PROFILES},}proxy"
fi
COMPOSE_PROFILES="$PROFILES" docker compose up -d --build 2>&1 | tail -5

# Wait for the app to be healthy
printf "Ожидание готовности"
for i in $(seq 1 60); do
  if curl -sf http://localhost:3000/api/health &>/dev/null; then
    printf '\n'
    ok "Приложение готово!"
    break
  fi
  if [ "$i" -eq 60 ]; then
    printf '\n'
    err "Превышено время ожидания. Проверьте логи: docker compose logs app"
    exit 1
  fi
  printf '.'
  sleep 2
done

# ── Done ────────────────────────────────────────────────────────────
SITE_URL="$(grep -E '^BETTER_AUTH_URL=' .env | cut -d= -f2- || true)"
SITE_URL="${SITE_URL:-http://localhost:3000}"
FTP_USER_SHOW="$(grep -E '^FTP_USER=' .env | cut -d= -f2- || true)"
FTP_PASS_SHOW="$(grep -E '^FTP_PASSWORD=' .env | cut -d= -f2- || true)"
DOMAIN_SHOW="$(grep -E '^DOMAIN=' .env | cut -d= -f2- || true)"
echo ""
printf "${GREEN}${BOLD}"
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║       🎉 МАГАЗИН УСПЕШНО ЗАПУЩЕН! 🎉        ║"
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
  echo "  и порты 80/443 открыты — сертификат выпустится за ~1 минуту."
fi
if [ -n "${FTP_PASS_SHOW}" ]; then
  echo ""
  echo "  FTP-доступ к загрузкам (фото товаров):"
  echo "    Хост:         порт 21 этого сервера (пассивные 21000-21010)"
  echo "    Пользователь: ${FTP_USER_SHOW:-techno}"
  echo "    Пароль:       ${FTP_PASS_SHOW}"
fi
echo ""
echo "  Все данные (БД + загрузки) хранятся на этой машине в Docker-томах."
echo "  Пароли и секреты — в файле .env (не удаляйте его)."
echo ""
echo "  Полезные команды:"
echo "    docker compose logs -f app   — логи приложения"
echo "    docker compose down          — остановить"
echo "    docker compose down -v       — остановить + удалить данные"
echo "    docker compose restart app   — перезапустить"
echo ""
echo "  Хотите сразу загрузить демо-данные (товары, категории, тестовые"
echo "  заказы) вместо мастера установки? Выполните ДО первого захода:"
echo "    docker compose exec app node scripts/db-setup.mjs --seed"
echo "  Это создаст демо-аккаунт admin@techno.store / Admin12345"
echo "  (смените пароль сразу после входа)."
echo ""
