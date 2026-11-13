# Store REST API v1 — документація для Android-додатка

Базовий URL: `https://powerfox.shop` (прод). Усі ендпоінти нижче — публічні, крім
`/api/v1/me/*` (сесія покупця). API побудовано поверх тієї ж логіки, що й сайт:
ціни, залишки, промокоди й підсумки завжди рахуються на сервері; те, що прислав
клієнт (ціна, сума, знижка), ігнорується.

## Загальні правила

- **Формат відповіді** — єдина оболонка `lib/api/helpers`:
  успіх: `{ "success": true, "data": ... }`,
  помилка: `{ "success": false, "error": "текст" }` з відповідним HTTP-статусом.
- **Помилки**: `400` — невалідні дані (повідомлення пояснює, що саме),
  `401` — потрібна сесія (`/me/*`), `404` — не знайдено,
  `409` — ідемпотентний повтор (`POST /api/v1/orders`, див. нижче),
  `429` — перевищено ліміт: `{ "success": false, "error": "rate_limited" }`.
  Трейси й внутрішні деталі ніколи не повертаються.
- **Ліміти** — на IP, за хвилину (див. таблицю нижче). Перевіряються до
  виконання роботи.
- **Локаль** — `uk` за замовчуванням; назви/описи беруться тією ж логікою, що й
  на сайті (`localeFromRequest`).
- **Пагінація** — `page` (за замовчуванням 1) і `perPage` (за замовчуванням 20,
  максимум 100). У списку товарів ефективний `perPage` обмежений спільною
  логікою каталогу до **48** — відповідь повертає фактичні значення.
- **Телефон** — українські номери, нормалізуються сервером (`067…` →
  `+380…`); не-українські відхиляються.
- **Секрети** — `config` методів доставки/оплати (ключ Нової Пошти, IBAN,
  реквізити шлюзів) ніколи не читається і не повертається; методи віддаються
  тільки як `{code, name}`.

## Ендпоінти

### Каталог

| Метод | Шлях | Ліміт | Опис |
|---|---|---|---|
| GET | `/api/v1/products` | 30/хв | Список товарів |
| GET | `/api/v1/products/[slug]` | 60/хв | Картка товару |
| GET | `/api/v1/categories` | 60/хв | Категорії |
| GET | `/api/search?q=` | 30/хв | Пошук (існуючий ендпоінт, не v1) |

**GET `/api/v1/products?q=&category=&sort=&page=&perPage=`**

- `q` — пошук (санітизується, макс. 100 символів; відсутній = без фільтра).
- `category` — slug або числовий id категорії; невідома → 400.
- `sort` — тільки `new | price_asc | price_desc | popular`; інше → 400.
- Відповідь: `{ items: [{ id, slug, name, price, oldPrice, currency, image,
  inStock, isPreorder, category? }], total, page, perPage }`.
  Поле `category` на товарах є тільки коли запит фільтрував за категорією.

**GET `/api/v1/products/[slug]`**

- Відповідь: `{ id, slug, name, description, price, oldPrice, currency, sku,
  brand, image, images[], characteristics: [{ name, value }], category?,
  inStock, isPreorder, gtin? }`.
  `description` — чистий текст (без HTML), обрізаний до 500 символів, `null`
  коли порожній. `gtin` — тільки коли є штрих-код. Невідомий slug → 404.

**GET `/api/v1/categories`**

- Відповідь: масив `[{ id, slug, name }]` — видимі категорії в порядку сайту.
  Кількості товарів (`productCount`) немає — окремого запиту-агрегату в движку
  не існує.

**GET `/api/search?q=`** (існуючий, не v1)

- `q` менше 2 символів → `{ items: [], total: 0 }` (не помилка).
  Повертає до 6 товарів: `{ id, slug, name, price, oldPrice, currency,
  image, inStock }`, плюс `total` і `locale`.

### Магазин і доставка

| Метод | Шлях | Ліміт | Опис |
|---|---|---|---|
| GET | `/api/v1/store` | 60/хв | Дані магазину, способи доставки/оплати |
| GET | `/api/v1/delivery/nova-poshta/cities?q=` | 30/хв | Пошук міст НП |
| GET | `/api/v1/delivery/nova-poshta/warehouses?cityRef=&q=` | 30/хв | Відділення НП |

**GET `/api/v1/store`**

- Відповідь: `{ name, phone?, email?, address?, currency: "UAH",
  deliveryMethods: [{ code, name }], paymentMethods: [{ code, name }] }`
  — тільки АКТИВНІ методи, тільки `code`+`name`.
- Спосіб оплати `online` ховається, коли не налаштовано жодного шлюзу
  (ним не можна скористатися). Валюта завжди `UAH` — налаштування валюти
  в движку немає.

**GET `/api/v1/delivery/nova-poshta/cities?q=`**

- `q` менше 2 символів або відсутній → `{ success: true, data: [] }`
  (не помилка, як у `/api/search`).
- Відповідь — та сама форма, що в чекауті сайту:
  `[{ ref, name, area, deliveryCityRef }]`. Ключ НП лишається на сервері.
  Помилка НП → `[]` (fail-soft, як у чекауті).

**GET `/api/v1/delivery/nova-poshta/warehouses?cityRef=&q=`**

- `cityRef` обов'язковий (UUID НП або `deliveryCityRef` міста з попереднього
  ендпоінта); невалідний → 400. Опційний `q` фільтрує відділення (макс. 50).
- Відповідь — та сама форма, що в чекауті: `[{ ref, name, number }]`.
  Фільтра за типом (`branch | postomat`) немає — чекаут повертає всі.

### Замовлення

| Метод | Шлях | Ліміт | Опис |
|---|---|---|---|
| POST | `/api/v1/orders` | 5/хв | Оформлення замовлення (гість) |
| POST | `/api/v1/orders/one-click` | 10/хв | Купівля в один клік |
| GET | `/api/v1/orders/[number]?phone=` | 30/хв | Статус замовлення |
| GET | `/api/v1/orders/[number]/payment?phone=` | 30/хв | Статус оплати |

**POST `/api/v1/orders`** — гостьовий чекаут, той самий код, що й на сайті
(`createStorefrontOrder`). Тіло:

```json
{
  "items": [{ "productId": 1, "quantity": 2, "variantId": 5 }],
  "customer": { "firstName": "Іван", "lastName": "Тест", "phone": "0671234567", "email": "test@example.com" },
  "delivery": { "method": "nova_poshta", "city": "Київ", "cityRef": "…", "branch": "Відділення №1", "warehouseRef": "…", "address": "…" },
  "payment": { "method": "cod" },
  "promoCode": "SALE10", "note": "…", "idempotencyKey": "<uuid>"
}
```

- `variantId`, `note`, `idempotencyKey` — опційні. `items`: 1–50 позицій,
  `quantity` 1–99. Методи доставки/оплати — тільки активні коди з
  `/api/v1/store`; невідомий → 400 зі списком допустимих.
- `idempotencyKey` має бути UUID; повторний запит із тим самим ключем, поки
  перший ще створює шлюзовий інвойс, повертає **409**
  `{ success: false, retryable: true, orderNumber }` — додаток має
  повторити той самий ключ, а не створювати друге замовлення.
- Успіх: `{ orderId, orderNumber, total, itemsTotal, discount, promoCode?,
  paymentMethod, paymentUrl?, requisites? }` — той самий payload, що й
  у чекауті сайту.
- Помилка чекауту (залишки, промокод, мін. сума) → 400 з її текстом.

**POST `/api/v1/orders/one-click`** — один товар, одна одиниця
(`quantity` має бути 1, якщо вказано). Тіло:
`{ productId, variantId?, quantity?, name, phone, idempotencyKey? }`.
Ціна перераховується з БД. Успіх: `{ orderId, orderNumber, total,
itemsTotal }`. Помилка ліміта самого екшена — 429.

**GET `/api/v1/orders/[number]?phone=+380…`** — `phone` обов'язковий.
Відсутній/невалідний телефон, невідомий номер і невідповідність телефона
повертають **однаковий 404** `{ success: false, error: "Замовлення не
знайдено" }` — за ендпоінтом не можна перевірити, чи існує номер замовлення.
Успіх: `{ orderNumber, status, paymentStatus, paymentMethod,
items: [{ name, quantity, price }], totals: { itemsTotal, deliveryCost,
discountTotal, total }, delivery: { method, city, branch, address,
trackingNumber }, createdAt }`. Без email, телефона, нотаток і даних шлюзу.
Повертаються всі статуси, включно з `pending_payment`.

**GET `/api/v1/orders/[number]/payment?phone=+380…`** — та сама перевірка
телефона і той самий 404. Успіх: тільки
`{ orderNumber, paid, paymentStatus }` — без сум і даних шлюзу. Статус
береться зі збереженого платіжного рядка (вебхуки — єдине джерело істини);
живий повторний запит до шлюзу не робиться. Для COD (немає платіжного
рядка) — `paymentStatus` замовлення (`unpaid`).

### Відгуки і питання

| Метод | Шлях | Ліміт | Опис |
|---|---|---|---|
| GET | `/api/v1/products/[slug]/reviews` | 60/хв | Відгуки товару |
| POST | `/api/v1/products/[slug]/reviews` | 5/хв | Залишити відгук |
| GET | `/api/v1/products/[slug]/questions` | 60/хв | Питання товару |
| POST | `/api/v1/products/[slug]/questions` | 5/хв | Задати питання |

**GET `/api/v1/products/[slug]/reviews?page=&perPage=`** — тільки схвалені
відгуки (макс. 100, як на сторінці товару). Відповідь:
`{ items: [{ authorName, rating, text, createdAt }], aggregate: { avg, count },
total, page, perPage }`. `aggregate` рахується з того ж масиву, що й список.
Невідомий slug → 404.

**POST `/api/v1/products/[slug]/reviews`** — тіло
`{ authorName, rating, text, orderNumber? }`: `rating` — ціле 1..5
(рядок `"5"` і `4.5` відхиляються), `text` обов'язковий, до 5000 символів.
`orderNumber` опційний — якщо вказано, замовлення має існувати (перевіряється
тільки існування, не зв'язок покупки). Текст санітизується; відгук іде на
модерацію (`pending`). Успіх: `{ success: true }` (рядок не повертається —
так само, як на сайті). Поля `pros`/`cons` з веб-форми API не приймає.

**GET `/api/v1/products/[slug]/questions`** — тільки питання З відповідями,
`{ items: [{ id, authorName, question, answer, answeredAt, createdAt }],
total, page, perPage, totalPages }`. Email питаючого ніколи не повертається.

**POST `/api/v1/products/[slug]/questions`** — тіло
`{ authorName, text, email? }`: ім'я до 120, текст до 3000 (санітизується),
email — якщо є, перевіряється формат. Питання іде на модерацію.
Успіх: `{ status: "pending" }`.

### Кабінет покупця (сесія)

| Метод | Шлях | Ліміт | Опис |
|---|---|---|---|
| GET | `/api/v1/me/orders` | 60/хв | Замовлення покупця |
| GET | `/api/v1/me/orders/[id]` | 60/хв | Деталі замовлення |

Авторизація — **сесійна кука Better Auth**, як на сайті; нової схеми токенів
не вигадано. Без сесії → 401. `[id]` — числовий id замовлення; чуже або
невідоме → 404. Форми — як на сторінці кабінету, але без поля `note`
(може містити реквізити) і без `userId`. Важливо для додатка: сесії Better
Auth прив'язані до IP /24 і до точного User-Agent, з яким створені — додаток
має надсилати **стабільний User-Agent** на всі запити, інакше сесія вбивається
і покупець мусить увійти знову.

## Тести

Нові файли: `tests/api-v1-products.test.ts` (20), `tests/api-v1-orders.test.ts`
(22), `tests/api-v1-orders-reviews.test.ts` (28), `tests/api-v1-store.test.ts`
(22), `tests/api-v1-extras.test.ts` (29) — разом 121 тест, усі моковані
за зразком `tests/track-validation.test.ts`. Центральна верифікація 13.11:
typecheck, lint, build чисті; повний набір — 1006 passed, 17 skipped (живі
Postgres-тести, скіпаються за дизайном), 0 failed.

## Що API свідомо НЕ робить

- Немає серверного кошика — кошик лишається на клієнті (як на сайті).
- Немає окремої схеми авторизації для додатка (тільки сесійна кука `/me/*`).
- Статус оплати не перезапитує шлюз живцем — тільки збережений рядок.
- `productCount` у категоріях і фільтр відділень за типом — немає (див. вище).
