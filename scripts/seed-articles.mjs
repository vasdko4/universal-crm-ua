// One-off seed: fills article_categories and articles with store-related content.
// Run: node --env-file=.env.local scripts/seed-articles.mjs
import pg from 'pg'

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })

const CATEGORIES = [
  { name: 'Новини', slug: 'news', description: 'Новини магазину та нові надходження', sort: 1 },
  { name: 'Огляди', slug: 'reviews', description: 'Огляди товарів з нашого каталогу', sort: 2 },
  { name: 'Гайди', slug: 'guides', description: 'Поради з вибору та використання техніки', sort: 3 },
]

const ARTICLES = [
  {
    slug: 'yak-vybraty-gan-zaryadnyi-prystrii',
    cat: 'guides',
    title: 'Як вибрати GaN зарядний пристрій у 2026 році: 65W чи 100W?',
    excerpt:
      'GaN-зарядки вдвічі менші за класичні та майже не гріються. Розбираємося, яка потужність потрібна саме вам і на що звертати увагу при виборі.',
    cover: 'https://images.prom.ua/7537760215_w700_h500_zaryadnoe-ustrojstvo-essager.jpg',
    tags: ['зарядні пристрої', 'GaN', 'поради'],
    minutes: 6,
    featured: true,
    content: `
<p>Технологія GaN (нітрид галію) змінила ринок зарядних пристроїв: замість громіздких «цеглинок» ми отримали компактні блоки, які заряджають ноутбук, смартфон і навушники одночасно. У каталозі <a href="/catalog?category=zariadnye-ustroistva-dlia-smartfonov-y-planshetov">зарядних пристроїв PowerFox</a> більшість моделей — саме GaN.</p>
<h2>Чому GaN кращий за класичний адаптер</h2>
<ul>
<li><strong>Компактність.</strong> GaN-транзистори працюють на вищих частотах, тому трансформатор менший — блок на 65W важить як старий на 20W.</li>
<li><strong>Менше нагрівання.</strong> ККД GaN-зарядок сягає 95%, енергія не втрачається у вигляді тепла.</li>
<li><strong>Кілька портів.</strong> Типова конфігурація — 2 Type-C + USB-A, потужність розподіляється автоматично.</li>
</ul>
<h2>Скільки ват потрібно?</h2>
<p><strong>65W</strong> — золота середина: швидка зарядка смартфона (PD/QC), планшета і більшості ультрабуків. Наприклад, <a href="/product/45">Essager Ultra Thin GaN 65W</a> — ультратонкий блок з USB-C та USB-A, який легко носити в кишені.</p>
<p><strong>100W</strong> — для тих, хто заряджає одночасно ноутбук і ще 2–3 пристрої. <a href="/product/41">Essager Grace 100W з 4 портами</a> замінює цілу розетку: 2 Type-C + 2 Type-A.</p>
<h2>На що ще звернути увагу</h2>
<ol>
<li><strong>Протоколи швидкої зарядки:</strong> PD 3.0 та QC 4.0 покривають iPhone, Samsung, Xiaomi та ноутбуки з USB-C.</li>
<li><strong>Висувний кабель.</strong> Моделі на кшталт <a href="/product/44">Essager ES-CD49 з висувним Type-C</a> позбавляють від пошуку кабелю.</li>
<li><strong>Сертифікація та захист</strong> від перегріву, перенапруги й короткого замикання — у всіх товарів нашого каталогу.</li>
</ol>
<p>Не впевнені у виборі? Напишіть нам у чат — підберемо зарядку під ваші пристрої.</p>`,
  },
  {
    slug: 'oglyad-essager-grace-100w',
    cat: 'reviews',
    title: 'Огляд Essager Grace 100W: одна зарядка замість чотирьох',
    excerpt:
      'Тестуємо флагманський GaN-блок Essager на 100W з чотирма портами: чи справді він заряджає ноутбук, смартфон, годинник і навушники одночасно?',
    cover: 'https://images.prom.ua/7537760215_w700_h500_zaryadnoe-ustrojstvo-essager.jpg',
    tags: ['Essager', 'огляд', 'GaN'],
    minutes: 5,
    featured: false,
    content: `
<p><a href="/product/41">Essager Grace 100W GaN</a> — старша модель у лінійці бренду і один з найпопулярніших товарів нашого магазину. Розповідаємо, що він уміє.</p>
<h2>Комплектація та дизайн</h2>
<p>Блок помітно менший за зарядку MacBook: складана вилка, матовий корпус, доступний у <a href="/product/41">чорному</a> та <a href="/product/43">білому</a> кольорах. Чотири порти: 2 Type-C та 2 Type-A.</p>
<h2>Потужність у реальних сценаріях</h2>
<ul>
<li><strong>Один Type-C:</strong> повні 100W — MacBook Pro 14 заряджається на максимальній швидкості.</li>
<li><strong>Type-C + Type-C:</strong> 65W + 30W — ноутбук плюс смартфон із швидкою зарядкою.</li>
<li><strong>Всі чотири порти:</strong> сумарно до 100W — ноутбук, телефон, годинник і навушники одночасно.</li>
</ul>
<h2>Підсумок</h2>
<p>За ціною 949 грн Grace 100W замінює три-чотири окремі зарядки — ідеальний варіант для подорожей та робочого столу. Якщо 100W забагато, зверніть увагу на <a href="/product/48">Essager Shining 65W</a> за 540 грн.</p>`,
  },
  {
    slug: 'shvydka-zaryadka-v-avto',
    cat: 'guides',
    title: 'Швидка зарядка в авто: як вибрати автомобільний зарядний пристрій',
    excerpt:
      'Прикурювач може заряджати смартфон так само швидко, як розетка вдома. Пояснюємо різницю між 105W і 200W та навіщо потрібен висувний кабель.',
    cover: 'https://images.prom.ua/7543279127_w700_h500_avtomobilnyj-derzhatel-s.jpg',
    tags: ['авто', 'зарядні пристрої', 'поради'],
    minutes: 5,
    featured: false,
    content: `
<p>Довга дорога з навігатором садить батарею швидше, ніж її встигає поповнити стара автозарядка на 10W. Сучасні автомобільні ЗП з PD 3.0 видають 65–200W — розбираємось, як вибрати.</p>
<h2>Потужність: скільки потрібно в авто</h2>
<p><a href="/product/54">Toocki 105W з висувним кабелем</a> — оптимум для більшості: швидка зарядка смартфона з навігацією плюс другий порт для пасажира. Висувний кабель Type-C 0,75 м завжди під рукою і не плутається.</p>
<p><a href="/product/55">Toocki 200W PD3.0 PPS</a> — для тих, хто заряджає в дорозі ноутбук або одразу кілька гаджетів: протокол PPS підтримує Samsung Super Fast Charging 2.0.</p>
<h2>Тримач із бездротовою зарядкою — альтернатива кабелю</h2>
<p>Якщо смартфон підтримує Qi, зручніший варіант — тримач із бездротовою зарядкою: <a href="/product/128">Baseus Milky Way Pro</a> кріпиться на дефлектор, тримає телефон магнітом і заряджає без проводів.</p>
<h2>Чек-лист перед покупкою</h2>
<ol>
<li>Перевірте протокол швидкої зарядки вашого смартфона (PD, QC, PPS).</li>
<li>Для навігації обирайте від 30W на порт — менше не встигає за екраном.</li>
<li>Захист від стрибків напруги в бортовій мережі — обов'язковий.</li>
</ol>
<p>Всі автомобільні зарядки — у розділі <a href="/catalog?category=avtoaksessuary">Аксесуари для авто</a>.</p>`,
  },
  {
    slug: 'oglyad-smart-godynnykiv-haylou',
    cat: 'reviews',
    title: 'Смарт-годинники Haylou Solar: огляд лінійки до 2000 грн',
    excerpt:
      'Haylou робить смарт-годинники з AMOLED-екранами, тижневою автономністю та металевим корпусом за ціною удвічі нижчою за конкурентів. Порівнюємо моделі лінійки.',
    cover: 'https://images.prom.ua/7544516618_w700_h500_smart-chasy-haylou-solar.jpg',
    tags: ['Haylou', 'смарт-годинники', 'огляд'],
    minutes: 6,
    featured: false,
    content: `
<p>Бренд Haylou (екосистема Xiaomi) закріпився в ніші доступних смарт-годинників. У <a href="/catalog?category=umnye-chasy-i-braslety">каталозі PowerFox</a> — актуальна лінійка Solar. Розбираємо, чим відрізняються моделі.</p>
<h2>Haylou Solar Neo LS21 — базова модель</h2>
<p><a href="/product/75">Solar Neo</a> у комплекті з двома ремінцями: 1.43" екран, пульсометр, SpO2, понад 100 спортивних режимів і до 12 днів автономності. Найкращий вибір для першого смарт-годинника.</p>
<h2>Solar Lite 2 — тонший і легший</h2>
<p><a href="/product/76">Solar Lite 2 у сріблястому корпусі</a> важить менше 40 г — комфортний для сну та моніторингу відновлення. Виміри пульсу цілодобово, сповіщення з телефону, вологозахист IP68.</p>
<h2>Кому підійдуть</h2>
<ul>
<li>Тим, хто хоче трекінг сну, пульсу та тренувань без підписок і зайвих налаштувань.</li>
<li>Користувачам Android та iPhone — застосунок Haylou Fun працює з обома системами.</li>
<li>Як подарунок: металевий корпус і AMOLED виглядають дорожче за свою ціну.</li>
</ul>
<p>Порада: до годинника візьміть <a href="/catalog?category=zariadnye-ustroistva-dlia-smartfonov-y-planshetov">компактну зарядку з USB-A портом</a> — магнітний кабель Haylou живиться саме від нього.</p>`,
  },
  {
    slug: 'yak-vybraty-tws-navushnyky',
    cat: 'guides',
    title: 'Як вибрати TWS-навушники: гайд по бездротових моделях Baseus',
    excerpt:
      'Шумозаглушення, затримка звуку в іграх, автономність — пояснюємо, які характеристики TWS-навушників справді важливі, на прикладі моделей з каталогу.',
    cover: 'https://images.prom.ua/7545996429_w700_h500_besprovodnye-naushniki-baseus.jpg',
    tags: ['навушники', 'Baseus', 'поради'],
    minutes: 5,
    featured: false,
    content: `
<p>Ринок TWS-навушників величезний, але 90% вибору зводиться до чотирьох параметрів. Розбираємо їх на моделях <a href="/catalog?category=naushniki-i-mikrofony">з нашого каталогу</a>.</p>
<h2>1. Шумозаглушення (ANC)</h2>
<p>Активне шумозаглушення прибирає гул транспорту та офісу. <a href="/product/80">Baseus Bowie H1i</a> глушить до 48 дБ шуму — в метро можна слухати подкасти на середній гучності.</p>
<h2>2. Автономність</h2>
<p>Хороший показник — 6+ годин від навушників і 30+ з кейсом. <a href="/product/79">Baseus Bass 35 Max</a> тримають до 50 годин сумарно.</p>
<h2>3. Затримка звуку</h2>
<p>Для ігор та відео важлива затримка до 0.06 с — шукайте ігровий режим у характеристиках.</p>
<h2>4. Посадка</h2>
<ul>
<li><strong>Вкладиші з амбушурами</strong> — краща шумоізоляція та бас.</li>
<li><strong>Відкриті</strong> — комфортніші для довгого носіння, чутно оточення.</li>
</ul>
<p>До навушників стане в пригоді <a href="/catalog?category=zariadnye-ustroistva-dlia-smartfonov-y-planshetov">компактний зарядний блок</a> — кейс заряджається від Type-C за 30–40 хвилин.</p>`,
  },
  {
    slug: 'oglyad-proove-jester-8k',
    cat: 'reviews',
    title: 'Proove Jester 8K: ігрова миша з бездротовою зарядкою',
    excerpt:
      'Сенсор 8000 Hz, вага 55 г і зарядна станція в комплекті. Розбираємо, чи варта ігрова миша Proove Jester своїх грошей.',
    cover: 'https://images.prom.ua/7545613826_w700_h500_besprovodnaya-igrovaya-mysh.jpg',
    tags: ['Proove', 'миші', 'огляд', 'ігри'],
    minutes: 4,
    featured: false,
    content: `
<p>Ігрові миші з частотою опитування 8000 Hz донедавна коштували від 5000 грн. <a href="/product/141">Proove Jester 8K</a> пропонує топові характеристики значно дешевше.</p>
<h2>Що в коробці</h2>
<p>Миша, зарядна док-станція, ресивер 2.4G та кабель Type-C. Станція — головна фішка: миша заряджається, стоячи на столі, як смартфон на бездротовій зарядці.</p>
<h2>Характеристики</h2>
<ul>
<li>Сенсор із частотою опитування до 8000 Hz — рухи без змазування навіть на моніторах 240 Гц.</li>
<li>Вага близько 55 г — легше за більшість офісних мишей.</li>
<li>Три режими підключення: 2.4G, Bluetooth, дріт.</li>
<li>До 80 годин без підзарядки в режимі 1000 Hz.</li>
</ul>
<h2>Висновок</h2>
<p>Для шутерів та MOBA — одна з найкращих покупок у своїй ціні. Доступна у <a href="/product/141">чорному</a> та <a href="/product/142">білому</a> кольорах у розділі <a href="/catalog?category=myshi-i-manipulyatory">Комп'ютерні миші</a>.</p>`,
  },
  {
    slug: 'nastilni-lampy-proove-dlya-domu',
    cat: 'guides',
    title: 'Настільні лампи з акумулятором: світло без розеток і проводів',
    excerpt:
      'Акумуляторні лампи Proove працюють до 8 годин без мережі, мають сенсорне керування та три температури світла. Розповідаємо, як вибрати свою.',
    cover: 'https://images.prom.ua/7545962985_w700_h500_nastolnaya-lampa-proove.jpg',
    tags: ['освітлення', 'Proove', 'дім'],
    minutes: 4,
    featured: false,
    content: `
<p>Лампа з вбудованим акумулятором — це світло там, де немає розетки: на балконі, в спальні над ліжком чи під час відключень електроенергії. У розділі <a href="/catalog?category=nastolnye-lampy">Настільні лампи і нічники</a> зібрані акумуляторні моделі Proove.</p>
<h2>Proove Light Tower — мінімалізм для робочого столу</h2>
<p><a href="/product/90">Light Tower 1200mAh</a> — тонка вежа з сенсорним димером. Три температури світла: тепле для вечора, нейтральне для читання, холодне для роботи.</p>
<h2>Proove On Fleek — більше автономності</h2>
<p><a href="/product/91">On Fleek 2200mAh</a> — акумулятор майже вдвічі більший, до 8 годин роботи на мінімальній яскравості. Зарядка через Type-C.</p>
<h2>Як вибрати</h2>
<ul>
<li><strong>Для роботи</strong> — нейтральне світло 4000K і регулювання яскравості.</li>
<li><strong>Для спальні</strong> — тепле світло 3000K, режим нічника.</li>
<li><strong>Про запас на відключення</strong> — беріть модель з більшим акумулятором.</li>
</ul>
<p>Порада: заряджайте лампу від того ж <a href="/catalog?category=zariadnye-ustroistva-dlia-smartfonov-y-planshetov">GaN-блока</a>, що й смартфон — достатньо будь-якого порту USB.</p>`,
  },
  {
    slug: 'zaryadni-prystroi-dlya-akumulyatoriv-12v',
    cat: 'guides',
    title: 'Як зарядити автомобільний акумулятор удома: гайд по ЗП на 12V',
    excerpt:
      'Інтелектуальні зарядні пристрої самі визначають стан АКБ, десульфатують пластини та вимикаються після заряджання. Пояснюємо, як ними користуватись.',
    cover: 'https://images.prom.ua/7539679958_w700_h500_intellektualnoe-zaryadnoe-ustrojstvo.jpg',
    tags: ['акумулятори', 'авто', 'поради'],
    minutes: 5,
    featured: false,
    content: `
<p>Якщо авто довго стоїть або їздить лише короткими маршрутами, акумулятор поступово розряджається. Інтелектуальний зарядний пристрій вирішує проблему без візиту на СТО — все з розділу <a href="/catalog?category=zaryadnye-ustrojstva-dlya-akkumulyatorov">Зарядні пристрої для акумуляторів</a>.</p>
<h2>Чим «інтелектуальний» кращий за трансформаторний</h2>
<ul>
<li><strong>Автоматичний цикл:</strong> пристрій сам визначає напругу АКБ, заряджає в кілька етапів і переходить у режим підтримки.</li>
<li><strong>Десульфатація:</strong> імпульсний режим відновлює пластини старих акумуляторів.</li>
<li><strong>Захист:</strong> від переполюсовки, короткого замикання та перегріву — не боїться помилок підключення.</li>
</ul>
<h2>Що вибрати</h2>
<p><a href="/product/66">EAFC 6A 12V</a> — компактна модель з LCD-екраном для легкових АКБ до 100 Аг: підключили ввечері — вранці акумулятор готовий.</p>
<p><a href="/product/67">EAFC для авто та мото</a> — універсал з режимами 12V/24V, підійде і для мотоцикла, і для позашляховика.</p>
<h2>Три правила безпечного заряджання</h2>
<ol>
<li>Заряджайте у провітрюваному приміщенні, знявши клеми з бортової мережі.</li>
<li>Спочатку підключіть крокодили до АКБ, потім пристрій до розетки.</li>
<li>Взимку занесіть акумулятор у тепло — холодна АКБ бере заряд повільніше.</li>
</ol>`,
  },
  {
    slug: 'novi-nadhodzhennya-powerfox-2026',
    cat: 'news',
    title: 'Нові надходження у PowerFox: що з’явилось у каталозі цього сезону',
    excerpt:
      'Поповнення асортименту: GaN-зарядки Essager і Toocki, смарт-годинники Haylou, ігрова периферія Proove та автотримачі Baseus. Огляд головних новинок.',
    cover: 'https://images.prom.ua/7537593441_w700_h500_blok-pitaniya-essager.jpg',
    tags: ['новини', 'новинки', 'PowerFox'],
    minutes: 4,
    featured: false,
    content: `
<p>Ми суттєво розширили каталог — розповідаємо про найцікавіші новинки сезону.</p>
<h2>Зарядні пристрої: ставка на GaN</h2>
<p>Лінійки <strong>Essager</strong> і <strong>Toocki</strong> від 65 до 100 Вт: від <a href="/product/45">ультратонкого Essager 65W</a> до <a href="/product/41">чотирипортового Grace 100W</a>. Окремо відзначимо моделі з висувним кабелем — <a href="/product/49">Essager 65W Retractable</a>, де кабель Type-C завжди з собою.</p>
<h2>Смарт-годинники Haylou</h2>
<p>Лінійка Solar — <a href="/product/75">Neo LS21 з двома ремінцями</a> та <a href="/product/76">тонкий Solar Lite 2</a>. AMOLED, до 12 днів автономності, ціна до 2000 грн.</p>
<h2>Периферія та дім</h2>
<ul>
<li><a href="/product/141">Ігрова миша Proove Jester 8K</a> із зарядною станцією в комплекті.</li>
<li><a href="/product/90">Акумуляторні настільні лампи Proove</a> — світло навіть без електрики.</li>
<li><a href="/product/128">Автотримачі Baseus з бездротовою зарядкою</a> для подорожей.</li>
</ul>
<p>Стежте за розділом <a href="/articles">Статті</a> — далі будуть детальні огляди новинок. На всі товари діє офіційна гарантія, доставка Новою Поштою по всій Україні.</p>`,
  },
]

async function main() {
  await client.connect()

  // Upsert article categories by slug.
  const catIds = {}
  for (const c of CATEGORIES) {
    const res = await client.query(
      `INSERT INTO article_categories (name, slug, description, sort_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, sort_order = EXCLUDED.sort_order
       RETURNING id`,
      [c.name, c.slug, c.description, c.sort],
    )
    catIds[c.slug] = res.rows[0].id
  }
  console.log('categories:', JSON.stringify(catIds))

  // Insert articles with staggered publish dates (oldest first).
  const now = Date.now()
  let inserted = 0
  for (let i = 0; i < ARTICLES.length; i++) {
    const a = ARTICLES[i]
    const publishedAt = new Date(now - (ARTICLES.length - i) * 3 * 24 * 60 * 60 * 1000)
    const res = await client.query(
      `INSERT INTO articles
        (title, slug, category_id, excerpt, content, cover_image, author, tags, status,
         is_featured, reading_minutes, meta_title, meta_description, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'published', $9, $10, $11, $12, $13)
       ON CONFLICT (slug) DO NOTHING
       RETURNING id`,
      [
        a.title,
        a.slug,
        catIds[a.cat],
        a.excerpt,
        a.content.trim(),
        a.cover,
        'PowerFox',
        JSON.stringify(a.tags),
        a.featured,
        a.minutes,
        a.title,
        a.excerpt,
        publishedAt,
      ],
    )
    if (res.rows[0]) inserted++
  }
  console.log('articles inserted:', inserted, 'of', ARTICLES.length)
  await client.end()
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
