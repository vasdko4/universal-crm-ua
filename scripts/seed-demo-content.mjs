// Fills the store with realistic demo content: articles, reviews, Q&A,
// customers, orders with history, and analytics events.
// Deterministic-ish and idempotent: tagged rows are wiped and re-inserted.
import { Pool } from 'pg'

const cs = process.env.DATABASE_URL.replace(/([?&])(sslmode|channel_binding)=[^&]*/gi, '$1').replace(/[?&]+$/g, '')
const pool = new Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } })

// Simple seeded PRNG for reproducible data
let seed = 42
function rnd() {
  seed = (seed * 1103515245 + 12345) % 2147483648
  return seed / 2147483648
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
const rint = (min, max) => min + Math.floor(rnd() * (max - min + 1))
const daysAgo = (n, hourJitter = true) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  if (hourJitter) d.setHours(rint(8, 21), rint(0, 59), rint(0, 59), 0)
  return d
}

const FIRST = ['Олександр', 'Марія', 'Іван', 'Ольга', 'Дмитро', 'Наталія', 'Сергій', 'Анна', 'Володимир', 'Юлія', 'Андрій', 'Катерина', 'Максим', 'Ірина', 'Павло', 'Тетяна', 'Олег', 'Світлана', 'Роман', 'Вікторія']
const LAST = ['Шевченко', 'Бондаренко', 'Ковальчук', 'Мельник', 'Кравченко', 'Ткаченко', 'Олійник', 'Лисенко', 'Петренко', 'Савченко', 'Руденко', 'Марченко', 'Козак', 'Мороз', 'Гончар']
const CITIES = ['Київ', 'Львів', 'Одеса', 'Харків', 'Дніпро', 'Вінниця', 'Запоріжжя', 'Полтава', 'Черкаси', 'Івано-Франківськ']

const REVIEW_TITLES_POS = ['Чудова покупка', 'Рекомендую', 'Все супер', 'Дуже задоволений', 'Найкраще за свої гроші', 'Якість на висоті', 'Перевершив очікування']
const REVIEW_BODIES_POS = [
  'Користуюся вже кілька тижнів — жодних нарікань. Якість збірки відмінна, все працює як заявлено.',
  'Швидка доставка, товар відповідає опису. Дуже задоволений покупкою, дякую магазину!',
  'Довго вибирав і не пошкодував. Співвідношення ціна/якість — одне з найкращих на ринку.',
  'Подарунок рідним — усі в захваті. Упаковка ціла, комплектація повна.',
  'Другий раз замовляю в цьому магазині. Все чесно: наявність, ціни, терміни.',
]
const REVIEW_BODIES_MID = [
  'В цілому непогано, але очікував трохи кращої якості матеріалів. За цю ціну — нормально.',
  'Товар хороший, але доставка затрималась на день. В іншому все влаштовує.',
  'Працює справно, хоча інструкція тільки англійською. Розібрався за відео на YouTube.',
]
const REVIEW_BODIES_NEG = [
  'На жаль, трапився брак — але магазин швидко замінив товар. За сервіс дякую.',
  'Не підійшов розмір, оформив повернення. Процес зайняв кілька днів.',
]
const PROS = ['Якість збірки', 'Швидка доставка', 'Гарна ціна', 'Зручність', 'Дизайн', 'Автономність', 'Комплектація']
const CONS = ['Ціна', 'Коротка інструкція', 'Маркий корпус', 'Довга доставка', '']
const QUESTIONS = [
  ['Чи є гарантія на цей товар?', 'Так, офіційна гарантія 12 місяців від виробника. Гарантійний талон додається до замовлення.'],
  ['Яка комплектація?', 'Повна заводська комплектація: пристрій, кабель, документація. Деталі — у характеристиках товару.'],
  ['Чи можна оплатити при отриманні?', 'Так, доступна оплата при отриманні у відділенні Нової Пошти (накладений платіж).'],
  ['Коли буде в наявності?', 'Очікуємо поставку протягом 7-10 днів. Натисніть "Повідомити про наявність", щоб отримати сповіщення.'],
  ['Чи підходить до моделі минулого року?', 'Так, повністю сумісний. Якщо є сумніви — напишіть нам модель, підкажемо точно.'],
  ['Це оригінальний товар?', 'Так, ми працюємо лише з офіційними постачальниками. Всі товари оригінальні та сертифіковані.'],
  ['Яка вага з упаковкою?', null],
  ['Чи є інші кольори?', 'Доступні кольори вказані на сторінці товару. Якщо кольору немає в списку — на жаль, він не постачається.'],
]

const ARTICLES = [
  {
    slug: 'how-to-choose-laptop-2026',
    title: 'Як вибрати ноутбук у 2026 році: повний гайд',
    cat: 'guides',
    cover: '/images/articles/choose-laptop.png',
    excerpt: 'Процесор, память, екран чи автономність — розбираємо, на що справді варто звертати увагу при виборі ноутбука.',
    featured: true,
    minutes: 8,
    content: `<h2>З чого почати</h2><p>Перше питання — не "який ноутбук найкращий", а "для чого він потрібен". Офісні задачі, навчання, монтаж відео та ігри висувають зовсім різні вимоги до заліза.</p><h2>Процесор і память</h2><p>Для повсякденних задач достатньо 16 ГБ оперативної памяті та процесора середнього класу. Для монтажу та розробки беріть 32 ГБ — це вже стандарт, а не розкіш.</p><h2>Екран</h2><p>IPS-матриця з покриттям 100% sRGB — мінімум для комфортної роботи. Якщо працюєте з кольором, дивіться в бік панелей із заводським калібруванням.</p><h2>Автономність</h2><p>Реальні 8-10 годин роботи — це те, що відрізняє робочий інструмент від "переносного компютера з розеткою". Звертайте увагу на ємність батареї від 70 Вт·год.</p><h2>Висновок</h2><p>Не переплачуйте за характеристики, якими не користуватиметеся. Краще вкладіться в якісний екран і батарею — саме їх ви "відчуваєте" щодня.</p>`,
  },
  {
    slug: 'smartwatch-buyers-guide',
    title: 'Огляд смарт-годинників: як обрати свій',
    cat: 'reviews',
    cover: '/images/articles/smartwatch-guide.png',
    excerpt: 'Порівнюємо популярні моделі смарт-годинників: автономність, датчики здоровя та сумісність зі смартфонами.',
    featured: false,
    minutes: 6,
    content: `<h2>Головні критерії</h2><p>Смарт-годинник — це передусім екосистема. Годинник має "дружити" з вашим смартфоном, інакше половина функцій залишиться недоступною.</p><h2>Здоровя та спорт</h2><p>Пульсометр, SpO2 та GPS сьогодні є навіть у бюджетних моделях. Різниця — у точності: флагмани відстежують тренування помітно коректніше.</p><h2>Автономність</h2><p>Від одного дня у "розумних" флагманів до двох тижнів у фітнес-орієнтованих моделей. Вирішіть, що вам важливіше — функції чи рідкісна зарядка.</p><h2>Підсумок</h2><p>Для iPhone найкращий вибір очевидний, для Android — дивіться на моделі з Wear OS або фірмовими оболонками. Бюджетні трекери чудово закривають базові потреби.</p>`,
  },
  {
    slug: 'wireless-charging-myths',
    title: 'Бездротова зарядка: міфи та реальність',
    cat: 'news',
    cover: '/images/articles/wireless-charging.png',
    excerpt: 'Чи шкодить бездротова зарядка батареї? Чи справді вона повільна? Розвінчуємо найпоширеніші міфи.',
    featured: false,
    minutes: 5,
    content: `<h2>Міф 1: бездротова зарядка вбиває батарею</h2><p>Сучасні контролери заряду керують температурою та струмом незалежно від способу зарядки. Деградація батареї залежить від циклів та тепла, а не від типу зарядного пристрою.</p><h2>Міф 2: це завжди повільно</h2><p>Стандарт Qi2 підтримує до 15 Вт, а фірмові рішення — до 50 Вт. Для нічної зарядки швидкість взагалі не має значення.</p><h2>Міф 3: чохол треба знімати</h2><p>Тонкі чохли до 3 мм не заважають зарядці. Виняток — чохли з металевими пластинами для магнітних тримачів.</p><h2>Висновок</h2><p>Бездротова зарядка — це зручність без суттєвих компромісів. Головне — купувати сертифіковані пристрої.</p>`,
  },
  {
    slug: 'gaming-headsets-budget',
    title: 'Ігрові гарнітури до 3000 грн: що обрати',
    cat: 'reviews',
    cover: '/images/articles/gaming-headsets.png',
    excerpt: 'Хороший звук в іграх не обовязково коштує дорого. Підібрали гарнітури з найкращим співвідношенням ціни та якості.',
    featured: false,
    minutes: 7,
    content: `<h2>На що звертати увагу</h2><p>У бюджетному сегменті головне — зручність посадки та якість мікрофона. Віртуальний обємний звук 7.1 у цій ціновій категорії частіше маркетинг, ніж перевага.</p><h2>Дротові чи бездротові</h2><p>Дротові моделі за ті ж гроші звучать краще і не потребують зарядки. Бездротові варті уваги, якщо граєте далеко від компютера.</p><h2>Мікрофон</h2><p>Знімний або відкидний мікрофон із шумозаглушенням — маст-хев для командних ігор. Перевіряйте записи тестів мікрофона перед покупкою.</p><h2>Підсумок</h2><p>За 2000-3000 грн можна отримати гарнітуру, якої вистачить на роки. Переплачувати за RGB-підсвітку чи ні — вирішувати вам.</p>`,
  },
  {
    slug: 'summer-tech-novelties-2026',
    title: 'Новинки літа 2026: що зявилося в магазині',
    cat: 'news',
    cover: '/images/articles/summer-novelties.png',
    excerpt: 'Поповнення асортименту: нові смартфони, аудіо та аксесуари для подорожей. Розповідаємо про найцікавіше.',
    featured: false,
    minutes: 4,
    content: `<h2>Аудіо для літа</h2><p>Портативні колонки з захистом від води IP67 та нові TWS-навушники з активним шумозаглушенням — саме те, що потрібно для відпустки.</p><h2>Зарядка в дорозі</h2><p>Компактні GaN-зарядки на 65 Вт заряджають ноутбук, смартфон і навушники одночасно — і важать менше 120 грамів.</p><h2>Аксесуари для подорожей</h2><p>Павербанки з швидкою зарядкою, універсальні кабелі та захисні чохли — все для того, щоб техніка пережила відпустку разом із вами.</p><h2>Слідкуйте за акціями</h2><p>На всі літні новинки діють знижки до 15% за промокодом із розсилки. Підписуйтесь, щоб не пропустити.</p>`,
  },
]

async function main() {
  const client = await pool.connect()
  try {
    // ---------- Load products ----------
    const prods = (await client.query(
      `SELECT id, name_uk, sku, image, price, options FROM products WHERE deleted_at IS NULL ORDER BY id`,
    )).rows
    const inStock = (await client.query(
      `SELECT id, name_uk, sku, image, price FROM products WHERE deleted_at IS NULL AND is_in_stock ORDER BY id`,
    )).rows
    console.log('products loaded:', prods.length)

    // ---------- Articles ----------
    const cats = (await client.query(`SELECT id, slug FROM article_categories`)).rows
    const catBySlug = Object.fromEntries(cats.map((c) => [c.slug, c.id]))
    for (const [i, a] of ARTICLES.entries()) {
      await client.query(
        `INSERT INTO articles (title, slug, category_id, excerpt, content, cover_image, author, tags, status, is_featured, views_count, reading_minutes, meta_title, meta_description, published_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'published',$9,$10,$11,$1,$4,$12,$12,NOW())
         ON CONFLICT (slug) DO UPDATE SET cover_image=EXCLUDED.cover_image, content=EXCLUDED.content, excerpt=EXCLUDED.excerpt`,
        [a.title, a.slug, catBySlug[a.cat] ?? null, a.excerpt, a.content, a.cover, 'Команда Techno Store', '{}', a.featured, rint(150, 2400), a.minutes, daysAgo(3 + i * 5)],
      )
    }
    console.log('articles upserted:', ARTICLES.length)

    // ---------- Reviews ----------
    await client.query(`DELETE FROM product_reviews WHERE author_email LIKE '%@demo.local'`)
    let reviews = 0
    for (const p of prods) {
      const n = rnd() < 0.25 ? 0 : rint(1, 5) // ~75% products have 1-5 reviews
      for (let i = 0; i < n; i++) {
        const rating = pick([5, 5, 5, 4, 4, 4, 3, 5, 4, 2])
        const body = rating >= 4 ? pick(REVIEW_BODIES_POS) : rating === 3 ? pick(REVIEW_BODIES_MID) : pick(REVIEW_BODIES_NEG)
        const fn = pick(FIRST), ln = pick(LAST)
        const status = rnd() < 0.9 ? 'approved' : 'pending'
        const reply = rating <= 3 && rnd() < 0.7 ? 'Дякуємо за відгук! Звʼяжіться з нами — обовʼязково допоможемо вирішити питання.' : null
        await client.query(
          `INSERT INTO product_reviews (product_id, author_name, author_email, rating, title, body, pros, cons, status, is_verified_purchase, admin_reply, helpful_count, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)`,
          [p.id, `${fn} ${ln[0]}.`, `${fn.toLowerCase()}.${ln.toLowerCase()}@demo.local`, rating,
           rating >= 4 ? pick(REVIEW_TITLES_POS) : null, body,
           rating >= 4 ? pick(PROS) : null, rating <= 3 ? pick(CONS) || null : null,
           status, rnd() < 0.6, reply, rint(0, 14), daysAgo(rint(1, 90))],
        )
        reviews++
      }
    }
    console.log('reviews inserted:', reviews)

    // ---------- Questions ----------
    await client.query(`DELETE FROM product_questions WHERE author_email LIKE '%@demo.local'`)
    let questions = 0
    for (const p of prods) {
      if (rnd() > 0.3) continue
      const [q, ans] = pick(QUESTIONS)
      const fn = pick(FIRST)
      const created = daysAgo(rint(2, 60))
      await client.query(
        `INSERT INTO product_questions (product_id, author_name, author_email, question, answer, status, answered_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)`,
        [p.id, fn, `${fn.toLowerCase()}@demo.local`, q, ans, ans ? 'answered' : 'pending', ans ? created : null, created],
      )
      questions++
    }
    console.log('questions inserted:', questions)

    // ---------- Customers ----------
    const existing = (await client.query(`SELECT COUNT(*)::int n FROM customers WHERE deleted_at IS NULL`)).rows[0].n
    const newCustomers = []
    for (let i = existing; i < 25; i++) {
      const fn = pick(FIRST), ln = pick(LAST)
      const r = await client.query(
        `INSERT INTO customers (first_name, last_name, phone, email, reliability_score, orders_count, total_turnover, tags, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,0,0,$6,$7,$7) RETURNING id`,
        [fn, ln, `+38067${rint(1000000, 9999999)}`, `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@demo.local`,
         rint(60, 100), rnd() < 0.2 ? '{VIP}' : '{}', daysAgo(rint(10, 120))],
      )
      newCustomers.push(r.rows[0].id)
    }
    console.log('customers added:', newCustomers.length)

    // ---------- Orders ----------
    await client.query(`DELETE FROM order_history WHERE order_id IN (SELECT id FROM orders WHERE note = 'demo-seed')`)
    await client.query(`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE note = 'demo-seed')`)
    await client.query(`DELETE FROM orders WHERE note = 'demo-seed'`)
    const customers = (await client.query(`SELECT id, first_name, last_name, phone, email FROM customers WHERE deleted_at IS NULL`)).rows
    const STATUSES = ['done', 'done', 'done', 'shipped', 'shipped', 'processing', 'accepted', 'new', 'new', 'cancelled']
    let orders = 0
    for (let i = 0; i < 34; i++) {
      const cust = pick(customers)
      const status = STATUSES[i % STATUSES.length]
      const created = daysAgo(rint(0, 60))
      const nItems = rint(1, 3)
      const items = []
      let itemsTotal = 0
      for (let j = 0; j < nItems; j++) {
        const p = pick(inStock)
        const qty = rint(1, 2)
        const price = Number(p.price)
        items.push({ p, qty, price })
        itemsTotal += price * qty
      }
      const deliveryCost = itemsTotal > 3000 ? 0 : 120
      const paid = status === 'done' || status === 'shipped' || rnd() < 0.4
      const o = await client.query(
        `INSERT INTO orders (order_number, status, customer_id, customer_name, customer_phone, customer_email, delivery_method, delivery_city, delivery_branch, payment_method, payment_status, items_total, delivery_cost, discount_total, total, items_count, currency, tags, note, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,'nova_poshta',$7,$8,$9,$10,$11,$12,0,$13,$14,'UAH','{}','demo-seed',$15,$15) RETURNING id`,
        [String(rint(400000000, 499999999)), status, cust.id, `${cust.first_name} ${cust.last_name ?? ''}`.trim(),
         cust.phone, cust.email, pick(CITIES), `Відділення №${rint(1, 120)}`,
         pick(['online', 'cod', 'online']), paid ? 'paid' : 'unpaid',
         itemsTotal.toFixed(2), deliveryCost.toFixed(2), (itemsTotal + deliveryCost).toFixed(2),
         items.reduce((s, it) => s + it.qty, 0), created],
      )
      const orderId = o.rows[0].id
      for (const it of items) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, name, sku, image, price, quantity, total, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [orderId, it.p.id, it.p.name_uk, it.p.sku, it.p.image, it.price.toFixed(2), it.qty, (it.price * it.qty).toFixed(2), created],
        )
      }
      await client.query(
        `INSERT INTO order_history (order_id, type, message, actor, created_at) VALUES ($1,'status','Замовлення створено','system',$2)`,
        [orderId, created],
      )
      if (status !== 'new') {
        await client.query(
          `INSERT INTO order_history (order_id, type, message, actor, created_at) VALUES ($1,'status',$2,'admin',$3)`,
          [orderId, `Статус змінено на «${status}»`, new Date(created.getTime() + 3600e3 * rint(1, 24))],
        )
      }
      orders++
    }
    console.log('orders inserted:', orders)

    // Refresh customer aggregates
    await client.query(`
      UPDATE customers c SET
        orders_count = s.n,
        total_turnover = s.total,
        last_order_date = s.last
      FROM (SELECT customer_id, COUNT(*)::int n, COALESCE(SUM(total),0) total, MAX(created_at) last
            FROM orders WHERE customer_id IS NOT NULL GROUP BY customer_id) s
      WHERE c.id = s.customer_id`)

    // ---------- Analytics events ----------
    await client.query(`DELETE FROM analytics_events WHERE session_id LIKE 'demo-%'`)
    let events = 0
    const values = []
    for (let d = 0; d < 30; d++) {
      const dayViews = rint(30, 90)
      for (let i = 0; i < dayViews; i++) {
        const p = pick(prods)
        const sess = `demo-${d}-${rint(1, 40)}`
        values.push([`product_view`, `/product/${p.id}`, p.id, null, null, sess, daysAgo(d)])
        events++
        if (rnd() < 0.18) { values.push([`add_to_cart`, `/product/${p.id}`, p.id, null, null, sess, daysAgo(d)]); events++ }
      }
    }
    // batch insert
    for (let i = 0; i < values.length; i += 500) {
      const chunk = values.slice(i, i + 500)
      const params = []
      const rows = chunk.map((v, j) => {
        params.push(...v)
        const b = j * 7
        return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7})`
      })
      await client.query(
        `INSERT INTO analytics_events (type, path, product_id, order_id, amount, session_id, created_at) VALUES ${rows.join(',')}`,
        params,
      )
    }
    console.log('analytics events inserted:', events)

    // Product views counters from events
    await client.query(`
      UPDATE products p SET views_count = COALESCE(s.n, 0)
      FROM (SELECT product_id, COUNT(*)::int n FROM analytics_events WHERE type='product_view' GROUP BY product_id) s
      WHERE p.id = s.product_id`)

    console.log('DONE')
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
