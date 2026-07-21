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
  echo ""
  echo "  Установите Docker:"
  echo "    • Linux:  curl -fsSL https://get.docker.com | sh"
  echo "    • macOS:  https://docs.docker.com/desktop/mac/install/"
  echo "    • Windows: https://docs.docker.com/desktop/windows/install/"
  echo ""
  exit 1
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
  # Generate secure secrets
  if command -v openssl &>/dev/null; then
    AUTH_SECRET=$(openssl rand -base64 32)
    CRON_SECRET_VAL=$(openssl rand -base64 32)
  else
    # Fallback: use /dev/urandom
    AUTH_SECRET=$(head -c 32 /dev/urandom | base64)
    CRON_SECRET_VAL=$(head -c 32 /dev/urandom | base64)
  fi

  cat > .env <<EOF
# Сгенерировано автоматически скриптом start.sh
# Не редактируйте вручную, если не знаете что делаете.

BETTER_AUTH_SECRET=${AUTH_SECRET}
BETTER_AUTH_URL=http://localhost:3000
CRON_SECRET=${CRON_SECRET_VAL}

# Раскомментируйте и укажите ваш домен для продакшена:
# BETTER_AUTH_URL=https://your-domain.com
# NEXT_PUBLIC_SITE_URL=https://your-domain.com
EOF
  ok "Файл .env создан с безопасными секретами"
else
  ok "Файл .env уже существует — используем его"
fi

# ── 3. Build & Start ────────────────────────────────────────────────
say "Запуск контейнеров (первая сборка может занять 2-5 минут)"

docker compose up -d --build 2>&1 | tail -5

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
echo ""
printf "${GREEN}${BOLD}"
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║       🎉 МАГАЗИН УСПЕШНО ЗАПУЩЕН! 🎉        ║"
echo "  ╠══════════════════════════════════════════════╣"
echo "  ║                                              ║"
echo "  ║  Откройте:  http://localhost:3000            ║"
echo "  ║                                              ║"
echo "  ║  При первом заходе вас автоматически         ║"
echo "  ║  перенаправит на мастер установки — там вы   ║"
echo "  ║  создадите магазин и свой admin-логин/пароль.║"
echo "  ╚══════════════════════════════════════════════╝"
printf "${NC}"
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
