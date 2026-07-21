# 🐳 Techno Store — установка через Docker

Самый простой способ запустить CRM-магазин. Нужен только Docker.

## Быстрый старт (одна команда)

```bash
# Клонируйте или распакуйте проект, затем:
chmod +x start.sh
./start.sh
```

Скрипт автоматически:
1. Проверит что Docker установлен
2. Сгенерирует безопасные секреты в `.env`
3. Соберёт приложение и запустит PostgreSQL
4. Применит схему базы данных (без демо-данных — магазин настраивается через мастер)

После запуска откройте **http://localhost:3000** — вас автоматически
перенаправит на мастер установки, где вы создадите магазин и свой собственный
admin-логин/пароль. Админ-центр после этого доступен по адресу
http://localhost:3000/admin.

**Хотите вместо этого сразу получить полную демо-копию магазина** (товары,
категории, тестовые заказы, готовый вход)? Выполните ДО первого открытия сайта:
```bash
docker compose exec app node scripts/db-setup.mjs --seed
```
Это создаст демо-аккаунт `admin@techno.store` / `Admin12345`
(⚠️ смените пароль сразу после входа).

## Управление через Makefile

```bash
make start       # Запустить магазин
make stop        # Остановить
make restart     # Перезапустить
make logs        # Просмотр логов
make status      # Статус контейнеров
make backup      # Бэкап базы данных
make restore     # Восстановить из бэкапа
make rebuild     # Пересобрать после изменений
make clean       # Удалить всё (включая данные!)
make help        # Показать все команды
```

## Управление через Docker Compose

```bash
docker compose up -d          # Запустить в фоне
docker compose down           # Остановить
docker compose logs -f app    # Логи приложения
docker compose logs -f db     # Логи базы данных
docker compose restart app    # Перезапустить только приложение
docker compose down -v        # Удалить вместе с данными
```

## Структура контейнеров

| Контейнер | Порт | Описание |
|-----------|------|----------|
| `techno-store-app` | 3000 | Next.js приложение |
| `techno-store-db` | 5433 | PostgreSQL 16 |

## Продакшен-настройка

### 1. Настройте домен

Отредактируйте `.env`:
```env
BETTER_AUTH_URL=https://your-domain.com
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

### 2. Поставьте обратный прокси (nginx)

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Включите HTTPS

```bash
# С certbot:
apt install certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

### 4. Настройте бэкапы

```bash
# Добавьте в crontab:
crontab -e

# Ежедневный бэкап в 3:00
0 3 * * * cd /path/to/project && make backup
```

## Загрузка фото товаров

Фото товаров в админ-центре по умолчанию сохраняются **локально**, в папку
`public/uploads/products` внутри контейнера — она вынесена в отдельный Docker
volume (`techno_store_uploads`), поэтому фото не пропадут при перезапуске или
пересборке контейнера (`docker compose down` без `-v`, `make rebuild`).

Ничего дополнительно настраивать не нужно — это работает "из коробки".

Если вы разворачиваете проект на Vercel (не через Docker) и хотите использовать
Vercel Blob вместо локального диска — просто добавьте `BLOB_READ_WRITE_TOKEN` в
переменные окружения проекта, приложение переключится на него автоматически.

⚠️ При удалении volume (`docker compose down -v` или `make clean`) все
загруженные фото товаров удаляются безвозвратно — сначала сделайте бэкап папки,
если это важно:
```bash
docker compose cp app:/app/public/uploads ./uploads-backup
```

## Google Merchant Center, Google Ads и Google Analytics

- **Google Ads (отслеживание конверсий):** Настройки → Google Ads / Analytics
  → впишите Conversion ID (`AW-XXXXXXXXX`) и Conversion Label из вашего
  аккаунта Google Ads. Сайт сам подключит gtag.js и отправит событие покупки
  на странице подтверждения заказа.
- **Google Analytics (GA4):** там же, включите тумблер и впишите Measurement
  ID (`G-XXXXXXXXXX`, Google Analytics → Администратор → Потоки данных). Сайт
  автоматически отправляет в GA4: просмотры страниц (включая переходы без
  перезагрузки), просмотр товара (`view_item`), добавление в корзину
  (`add_to_cart`) и покупку (`purchase`) — вся воронка продаж видна в отчётах
  GA4 "Электронная торговля" без какой-либо дополнительной настройки.
- **Google Merchant Center (товарный фид):** там же есть готовая ссылка на
  XML-фид (`/feed/google-merchant.xml`) — скопируйте её и добавьте в Merchant
  Center как фид с заданным временем получения (Продукты → Фиды → «+»). Фид
  обновляется автоматически. Для отдельного фида на русском добавьте
  `?locale=ru` к ссылке.

## Переменные окружения

| Переменная | Обязательна | Описание |
|-----------|:-----------:|----------|
| `BETTER_AUTH_SECRET` | ✅ | Секрет аутентификации (генерируется автоматически) |
| `BETTER_AUTH_URL` | ✅ | URL приложения (по умолчанию http://localhost:3000) |
| `CRON_SECRET` | ✅ | Секрет для защиты cron-эндпоинтов |
| `NEXT_PUBLIC_SITE_URL` | ❌ | Публичный URL для SEO |
| `NOVA_POSHTA_API_KEY` | ❌ | API-ключ Новой Почты |

## Подключение к базе данных

```bash
# Через docker compose:
docker compose exec db psql -U techno -d techno_store

# Или напрямую (порт 5433 на хосте):
psql postgres://techno:techno@localhost:5433/techno_store
```

## Обновление

```bash
# 1. Получите новую версию кода
# 2. Пересоберите:
make rebuild

# Или вручную:
docker compose up -d --build
```

## Устранение неполадок

**Контейнер не запускается:**
```bash
docker compose logs app   # Посмотреть ошибки
```

**База недоступна:**
```bash
docker compose logs db    # Проверить PostgreSQL
docker compose restart db # Перезапустить БД
```

**Порт 3000 занят:**
```bash
# Измените порт в docker-compose.yml:
ports:
  - "8080:3000"   # Доступ через http://localhost:8080
```

**Мало памяти при сборке:**
```bash
# Увеличьте лимит Docker Desktop до 4GB RAM
# Или добавьте swap на сервере:
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
```
