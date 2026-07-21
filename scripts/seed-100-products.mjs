// Seeds the catalog up to 100 products with full feature coverage:
// colors with swatches, text options (memory/size), per-combination variants,
// sizes[], characteristics, discounts, out-of-stock, popular flags, groups.
import { Pool } from 'pg'

const cs = process.env.DATABASE_URL.replace(/([?&])(sslmode|channel_binding)=[^&]*/gi, '$1').replace(/[?&]+$/g, '')
const pool = new Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } })

// Deterministic PRNG so reruns produce the same data.
let seed = 42
function rnd() {
  seed = (seed * 1103515245 + 12345) % 2147483648
  return seed / 2147483648
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
const shuffle = (arr) => [...arr].sort(() => rnd() - 0.5)

const COLORS = {
  Чорний: '#1a1a1a',
  Білий: '#f5f5f5',
  Синій: '#1e3a8a',
  Червоний: '#b91c1c',
  Зелений: '#166534',
  Сірий: '#6b7280',
  Рожевий: '#db2777',
  Фіолетовий: '#6d28d9',
  Золотий: '#b8860b',
  Срібний: '#c0c0c0',
}
const COLORS_RU = {
  Чорний: 'Черный', Білий: 'Белый', Синій: 'Синий', Червоний: 'Красный', Зелений: 'Зеленый',
  Сірий: 'Серый', Рожевий: 'Розовый', Фіолетовий: 'Фиолетовый', Золотий: 'Золотой', Срібний: 'Серебристый',
}

// [nameUk, nameRu, image, categorySlug, basePrice, kind]
// kind: 'memory' | 'color' | 'color+memory' | 'size' | 'plain' | 'color+size'
const TEMPLATES = [
  ['Смартфон Galaxy S24', 'Смартфон Galaxy S24', '/products/phone-1.png', 'electronics', 32999, 'color+memory'],
  ['Смартфон Pixel 9', 'Смартфон Pixel 9', '/products/phone-2.png', 'electronics', 28499, 'color+memory'],
  ['Смартфон Xiaomi 14T', 'Смартфон Xiaomi 14T', '/products/phone-3.png', 'electronics', 19999, 'memory'],
  ['Ноутбук ProBook 14', 'Ноутбук ProBook 14', '/products/laptop-pro.png', 'electronics', 45999, 'memory'],
  ['Планшет Tab S10', 'Планшет Tab S10', '/products/tablet.png', 'electronics', 21499, 'color+memory'],
  ['Смарт-годинник Watch Fit', 'Смарт-часы Watch Fit', '/products/smartwatch.png', 'electronics', 7499, 'color+size'],
  ['Монітор 27" QHD', 'Монитор 27" QHD', '/products/monitor.png', 'peripherals', 11999, 'plain'],
  ['Вебкамера FullHD Pro', 'Вебкамера FullHD Pro', '/products/webcam.png', 'peripherals', 2299, 'plain'],
  ['Ігрова гарнітура HX-90', 'Игровая гарнитура HX-90', '/products/gaming-headset.png', 'audio', 3499, 'color'],
  ['Навушники TWS Air', 'Наушники TWS Air', '/products/airpods-pro-2.png', 'audio', 4999, 'color'],
  ['Колонка BoomBox mini', 'Колонка BoomBox mini', '/products/jbl-charge-5.png', 'audio', 5299, 'color'],
  ['Клавіатура механічна K-Pro', 'Клавиатура механическая K-Pro', '/products/keychron-k2.png', 'peripherals', 4199, 'color'],
  ['Миша ігрова GX-502', 'Мышь игровая GX-502', '/products/logitech-g502.png', 'peripherals', 2799, 'color'],
  ['Павербанк 20000 мАг', 'Повербанк 20000 мАч', '/products/powerbank.png', 'accessories', 1599, 'color'],
  ['Зарядка GaN 65W', 'Зарядка GaN 65W', '/products/charger-gan.png', 'accessories', 1299, 'color'],
  ['Чохол захисний Shield', 'Чехол защитный Shield', '/products/iphone-case.png', 'accessories', 599, 'color+size'],
  ['Футболка з логотипом Tech', 'Футболка с логотипом Tech', '/products/tshirt-1.png', 'accessories', 749, 'color+size'],
  ['Кросівки Runner Lite', 'Кроссовки Runner Lite', '/products/sneaker-1.png', 'accessories', 2999, 'color+size'],
]
const SERIES = ['', ' Plus', ' Max', ' SE', ' Lite', ' 2', ' Ultra']
const MEMORY = ['128 ГБ', '256 ГБ', '512 ГБ']
const WATCH_SIZES = ['40 мм', '44 мм']
const CLOTH_SIZES = ['S', 'M', 'L', 'XL']
const SHOE_SIZES = ['40', '41', '42', '43', '44']
const CASE_SIZES = ['для iPhone 15', 'для iPhone 15 Pro', 'для Galaxy S24']

function buildOptions(kind, name) {
  const options = []
  if (kind.includes('color')) {
    const values = shuffle(Object.keys(COLORS)).slice(0, 2 + Math.floor(rnd() * 3))
    options.push({ name: 'Колір', type: 'color', values, swatches: Object.fromEntries(values.map((v) => [v, COLORS[v]])) })
  }
  if (kind.includes('memory')) options.push({ name: "Пам'ять", type: 'text', values: MEMORY })
  if (kind.includes('size')) {
    let values = CLOTH_SIZES
    if (/годинник|Watch/i.test(name)) values = WATCH_SIZES
    else if (/Кросівки|Runner/i.test(name)) values = SHOE_SIZES
    else if (/Чохол|Shield/i.test(name)) values = CASE_SIZES
    options.push({ name: 'Розмір', type: 'text', values })
  }
  return options
}

// Cartesian product of option values -> variant combos.
function combos(options) {
  return options.reduce((acc, o) => acc.flatMap((c) => o.values.map((v) => ({ ...c, [o.name]: v }))), [{}])
}

async function main() {
  const cats = Object.fromEntries(
    (await pool.query('SELECT id, slug FROM categories')).rows.map((r) => [r.slug, r.id]),
  )
  const existing = (await pool.query('SELECT COUNT(*)::int n FROM products WHERE deleted_at IS NULL')).rows[0].n
  const target = 100 - existing
  if (target <= 0) { console.log('Already at 100+, nothing to do'); return }
  console.log(`Seeding ${target} products (existing: ${existing})`)

  let created = 0
  outer: for (const s of SERIES) {
    for (const [nameUk, nameRu, image, catSlug, basePrice, kind] of TEMPLATES) {
      if (created >= target) break outer
      const fullUk = nameUk + s
      const fullRu = nameRu + s
      const dup = await pool.query('SELECT 1 FROM products WHERE name_uk=$1 LIMIT 1', [fullUk])
      if (dup.rows.length) continue

      const price = Math.round(basePrice * (1 + rnd() * 0.35))
      const hasDiscount = rnd() < 0.35
      const oldPrice = hasDiscount ? Math.round(price * (1.1 + rnd() * 0.25)) : null
      const inStock = rnd() > 0.12 // ~12% out of stock
      const quantity = inStock ? 3 + Math.floor(rnd() * 50) : 0
      const isPopular = rnd() < 0.2
      const options = buildOptions(kind, fullUk)
      const sku = `SKU-${String(1000 + created)}-${catSlug.slice(0, 3).toUpperCase()}`

      const res = await pool.query(
        `INSERT INTO products (name_uk, name_ru, description_uk, description_ru, sku, price, old_price, currency,
           quantity, unit, stock_status, image, images, sizes, options, is_visible, is_in_stock, is_popular,
           sort_order, weight, meta_title_uk, meta_title_ru, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'UAH',$8,'шт',$9,$10,$11,'[]',$12,true,$13,$14,$15,$16,$17,$18,NOW(),NOW())
         RETURNING id`,
        [
          fullUk, fullRu,
          `${fullUk} — надійна модель з гарантією 12 місяців. Офіційна поставка, швидка доставка по Україні.`,
          `${fullRu} — надежная модель с гарантией 12 месяцев. Официальная поставка, быстрая доставка по Украине.`,
          sku, price, oldPrice, quantity,
          inStock ? 'in_stock' : 'out_of_stock',
          image, JSON.stringify([image]),
          JSON.stringify(options), inStock, isPopular,
          created, (0.2 + rnd() * 2).toFixed(2), fullUk, fullRu,
        ],
      )
      const pid = res.rows[0].id

      await pool.query('INSERT INTO product_category (product_id, category_id) VALUES ($1,$2)', [pid, cats[catSlug]])

      // Variants for products with options (cap at 12 combos).
      if (options.length > 0) {
        const all = combos(options).slice(0, 12)
        let vi = 0
        for (const combo of all) {
          const extra = Object.values(combo).some((v) => /512|Max|XL|44/.test(v)) ? Math.round(price * 0.15) : 0
          const vQty = inStock ? Math.max(0, Math.floor(rnd() * 15) - 1) : 0
          await pool.query(
            `INSERT INTO product_variants (product_id, options, sku, price, old_price, quantity, is_in_stock, sort_order)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [pid, JSON.stringify(combo), `${sku}-V${vi}`, price + extra, oldPrice ? oldPrice + extra : null, vQty, vQty > 0, vi],
          )
          vi++
        }
      }

      // Characteristics.
      const chars = [
        ['Гарантія', '12 місяців'],
        ['Країна виробництва', pick(['Китай', "В'єтнам", 'Тайвань'])],
        ['Стан', 'Новий'],
      ]
      if (kind.includes('memory')) chars.push(["Оперативна пам'ять", pick(['8 ГБ', '12 ГБ', '16 ГБ'])])
      let ci = 0
      for (const [n, v] of chars) {
        await pool.query(
          'INSERT INTO product_characteristics (product_id, name, value, sort_order) VALUES ($1,$2,$3,$4)',
          [pid, n, v, ci++],
        )
      }
      created++
    }
  }
  const total = (await pool.query('SELECT COUNT(*)::int n FROM products WHERE deleted_at IS NULL')).rows[0].n
  console.log(`Created ${created}. Total products now: ${total}`)
}

main().then(() => pool.end()).catch((e) => { console.error(e); process.exit(1) })
