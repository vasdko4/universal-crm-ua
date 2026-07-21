# Локальная копия базы данных

Файл `db/dump.sql` — полный дамп базы (схема + все данные), пригодный для
восстановления на локальном сервере PostgreSQL для тестирования.

Содержит: 41 таблицу, последовательности (с текущими значениями),
внешние ключи, уникальные/проверочные ограничения и индексы, а также все
текущие данные магазина (100+ товаров, категории, галереи, статьи, заказы,
настройки, учётные записи).

## Быстрый способ (без psql, кросс-платформенно)

Если проект уже настроен (`.env.local` с `DATABASE_URL`), восстановить весь
снимок можно одной командой — она использует драйвер `pg`, а не бинарь `psql`:

```bash
pnpm db:restore        # DROP схемы + восстановление из db/dump.sql
```

А чтобы поднять всё «с нуля» (env + зависимости + Postgres в Docker + снимок):

```bash
pnpm setup --dump
```

## 1. Восстановление базы вручную (psql)

Нужен установленный PostgreSQL (14+).

```bash
# создать пустую базу
createdb myshop

# залить дамп
psql myshop -f db/dump.sql
```

Или через Docker, без локальной установки PostgreSQL:

```bash
docker run --name myshop-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16

# дождаться запуска, затем:
docker exec -i myshop-db psql -U postgres -c "CREATE DATABASE myshop"
docker exec -i myshop-db psql -U postgres -d myshop < db/dump.sql
```

## 2. Настройка приложения

Создайте файл `.env.local` в корне проекта и укажите строку подключения
к локальной базе:

```bash
# локальный PostgreSQL
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/myshop"

# секрет авторизации (сгенерируйте свой)
BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
```

## 3. Запуск

```bash
pnpm install
pnpm dev
```

Приложение будет доступно на http://localhost:3000.

## Пересоздание дампа

Чтобы обновить дамп из текущей (облачной) базы:

```bash
pnpm db:dump           # берёт DATABASE_URL из .env.local
# или напрямую из другого env-файла:
node --env-file=.env.development.local scripts/dump-db.mjs
```

Скрипт `scripts/dump-db.mjs` формирует значения средствами самого PostgreSQL,
поэтому все типы (jsonb, timestamptz, numeric, boolean) переносятся корректно.
