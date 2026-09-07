#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Techno Store 2.0 — запуск в одну команду через Docker
#
# Использование:
#   chmod +x start.sh
#   ./start.sh
#
# Скрипт полностью автоматический:
#   0. На Linux-ВМ: пакеты, timezone, swap, firewall
#   1. Проверяет что Docker установлен и запущен (ставит сам, если нет)
#   2. Генерирует .env файл с безопасными секретами (если не существует)
#   3. Собирает и запускает приложение + базу данных
#   4. Применяет схему БД (мастер установки — при первом заходе)
#
# Для остановки:  docker compose down
# Для удаления данных: docker compose down -v
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

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

# ── 0. Подготовка Linux-ВМ ──────────────────────────────────────────
if [ "$(uname -s)" = "Linux" ] && [ "${SKIP_VM_SETUP:-0}" != "1" ] && as_root true >/dev/null 2>&1; then
  say "Подготовка виртуальной машины"
  export DEBIAN_FRONTEND=noninteractive
  if command -v apt-get >/dev/null 2>&1; then
    as_root apt-get update -qq || true
    as_root apt-get install -y -qq curl ca-certificates openssl ufw >/dev/null || true
  fi
  command -v timedatectl >/dev/null 2>&1 && as_root timedatectl set-timezone Europe/Kyiv >/dev/null 2>&1 || true
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
      ok "Swap 2G — RAM было ${TOTAL_MEM_MB}MB"
    fi
  fi
fi

# ── 1. Prerequisites ────────────────────────────────────────────────
say "Проверка Docker"

if ! command -v docker &>/dev/null; then
  err "Docker не найден!"
  if [ "$(uname -s)" = "Linux" ]; then
    say "Установка Docker (get.docker.com)"
    if ! as_root true >/dev/null 2>&1; then
      echo "  Нужен root/sudo. Установите Docker: curl -fsSL https://get.docker.com | sh"
      exit 1
    fi
    curl -fsSL https://get.docker.com | as_root sh
    command -v systemctl &>/dev/null && as_root systemctl enable --now docker || true
    [ "$(id -u)" != "0" ] && as_root usermod -aG docker "$USER" || true
    ok "Docker установлен"
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

for i in $(seq 1 30); do
  docker_bin info >/dev/null 2>&1 && break
  if [ "$i" -eq 30 ]; then
    err "Docker-демон не запущен. Запустите Docker Desktop или службу docker."
    exit 1
  fi
  sleep 1
done

if ! docker_bin compose version >/dev/null 2>&1; then
  err "Docker Compose не найден (нужен docker compose v2+)."
  exit 1
fi

ok "Docker готов"

# ── 2. Environment file ─────────────────────────────────────────────
say "Настройка окружения"

if [ ! -f .env ]; then
  if [ -z "${DOMAIN:-}" ] && [ -t 0 ]; then
    echo ""
    echo "  Укажите домен, на котором будет работать магазин"
    echo "  (например: shop.example.com). Оставьте пустым для localhost."
    read -r -p "  Домен: " DOMAIN || DOMAIN=""
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

  gen_secret() {
    if command -v openssl &>/dev/null; then openssl rand -base64 32; else head -c 32 /dev/urandom | base64; fi
  }
  gen_password() {
    if command -v openssl &>/dev/null; then openssl rand -hex 16; else head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n'; fi
  }
  AUTH_SECRET=$(gen_secret)
  CRON_SECRET_VAL=$(gen_secret)
  UPDATER_SECRET_VAL=$(gen_secret)
  DB_PASSWORD=$(gen_password)
  FTP_USER_VAL="techno"
  FTP_PASSWORD_VAL=$(gen_password)
  PROJECT_NAME_VAL="$(basename "$PWD")"

  cat > .env <<ENVEOF
# Сгенерировано автоматически скриптом start.sh (Magazine 2.0)
# Не редактируйте вручную, если не знаете что делаете.

# Публичный адрес магазина (авторизация + SEO: canonical, sitemap, robots).
BETTER_AUTH_URL=${PUBLIC_URL}
NEXT_PUBLIC_SITE_URL=${PUBLIC_URL}

# Секреты (сгенерированы автоматически).
BETTER_AUTH_SECRET=${AUTH_SECRET}
CRON_SECRET=${CRON_SECRET_VAL}
UPDATER_SECRET=${UPDATER_SECRET_VAL}

# Имя проекта docker-compose (= эта папка) — нужно для сайдкара автообновления
# (страница /admin/updates → «Обновить»), чтобы он гарантированно обновлял
# именно этот стек контейнеров.
COMPOSE_PROJECT_NAME=${PROJECT_NAME_VAL}

# Пользователь БД: techno / пароль ниже (создаётся при первом запуске).
POSTGRES_PASSWORD=${DB_PASSWORD}

# FTP-доступ к папке загрузок (фото товаров): порт 21, пассивные 21000-21010.
FTP_USER=${FTP_USER_VAL}
FTP_PASSWORD=${FTP_PASSWORD_VAL}
# Для доступа к FTP извне укажите внешний IP или домен сервера:
FTP_ADDRESS=${PUBLIC_IP}

# Домен магазина. Если указан — запускается встроенный реверс-прокси Caddy:
# он сам получает и продлевает SSL-сертификат Let's Encrypt (nginx не нужен).
DOMAIN=${DOMAIN}
ENVEOF
  chmod 600 .env
  ok "Файл .env создан: адрес ${PUBLIC_URL}, секреты и пароли сгенерированы"
else
  ok "Файл .env уже существует — используем его"
fi

# ── 2b. Firewall ────────────────────────────────────────────────────
if [ "$(uname -s)" = "Linux" ] && command -v ufw >/dev/null 2>&1 && as_root true >/dev/null 2>&1; then
  as_root ufw allow OpenSSH >/dev/null 2>&1 || as_root ufw allow 22/tcp >/dev/null 2>&1 || true
  as_root ufw allow 80/tcp >/dev/null 2>&1 || true
  as_root ufw allow 443/tcp >/dev/null 2>&1 || true
  if ! grep -qE '^DOMAIN=[^[:space:]]+' .env 2>/dev/null; then
    as_root ufw allow 3000/tcp >/dev/null 2>&1 || true
  fi
  if grep -qE '^FTP_PASSWORD=.+' .env 2>/dev/null; then
    as_root ufw allow 21/tcp >/dev/null 2>&1 || true
    as_root ufw allow 21000:21010/tcp >/dev/null 2>&1 || true
  fi
  as_root ufw --force enable >/dev/null 2>&1 || true
fi

# ── 3. Build & Start ────────────────────────────────────────────────
say "Запуск контейнеров (первая сборка может занять 2-5 минут)"

PROFILES=""
if grep -qE '^FTP_PASSWORD=.+' .env 2>/dev/null; then
  PROFILES="ftp"
fi
if grep -qE '^DOMAIN=[^[:space:]]+' .env 2>/dev/null; then
  PROFILES="${PROFILES:+${PROFILES},}proxy"
fi
COMPOSE_PROFILES="$PROFILES" docker_bin compose up -d --build

printf "Ожидание готовности"
READY=0
for i in $(seq 1 90); do
  if curl -sf http://127.0.0.1:3000/api/health &>/dev/null; then
    printf '\n'
    ok "Приложение готово!"
    READY=1
    break
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

# ── Done ────────────────────────────────────────────────────────────
SITE_URL="$(grep -E '^BETTER_AUTH_URL=' .env | cut -d= -f2- || true)"
SITE_URL="${SITE_URL:-http://localhost:3000}"
FTP_USER_SHOW="$(grep -E '^FTP_USER=' .env | cut -d= -f2- || true)"
FTP_PASS_SHOW="$(grep -E '^FTP_PASSWORD=' .env | cut -d= -f2- || true)"
DOMAIN_SHOW="$(grep -E '^DOMAIN=' .env | cut -d= -f2- || true)"
echo ""
printf "${GREEN}${BOLD}"
echo "  ╔═══════════════════════════════════════════════╗"
echo "  ║       🎉 МАГАЗИН 2.0 УСПЕШНО ЗАПУЩЕН! 🎉        ║"
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
