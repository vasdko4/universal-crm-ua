export type TemplateId =
  | 'classic'
  | 'warm'
  | 'dark-tech'
  | 'elegant'
  | 'marketplace'
  | 'boutique'
  | 'nordic'
  | 'berry'
  | 'ocean'
  | 'forest'
  | 'mint'
  | 'cosmetics'
  | 'fashion'
  | 'electronics'
  | 'autoparts'
  | 'food'
  | 'sneakers'
  | 'pharmacy'
  | 'sport'
  | 'toys'
  | 'autochem'
  | 'tea'
  | 'books'
  | 'plumbing'
  | 'home'
  | 'furniture'
  | 'tools'
  | 'pets'
  | 'flowers'
  | 'jewelry'
  | 'gifts'
  | 'garden'
  | 'gaming'
  | 'stationery'
  | 'hobby'
  | 'appliances'
  | 'moto'
  | 'bikes'
  | 'music'
  | 'optics'
  | 'fishing'

/**
 * Home page hero layout used by the template.
 *  - standard: side-by-side hero with photo (classic look)
 *  - marketplace: compact promo banner + dense category tiles (Prom-style)
 *  - boutique: full-width editorial hero with overlaid text
 *  - minimal: typographic hero without a photo, oversized heading
 */
export type TemplateLayout = 'standard' | 'marketplace' | 'boutique' | 'minimal'

export type TemplatePreset = {
  id: TemplateId
  name: string
  nameRu: string
  description: string
  descriptionRu: string
  /** Preview swatches (CSS colors) shown on the selection card. */
  swatches: { bg: string; card: string; primary: string; accent: string }
  radius: string
  /** Which storefront layout the template uses (not just colors). */
  layout: TemplateLayout
  /** Premium templates get a badge in the admin selector. */
  premium?: boolean
  /** Niche templates are grouped separately in the admin selector. */
  niche?: boolean
}

export const TEMPLATES: TemplatePreset[] = [
  {
    id: 'classic',
    name: 'Класичний',
    nameRu: 'Классический',
    description: 'Світлий, бірюзовий акцент, помірні скруглення. Універсальний вигляд.',
    descriptionRu: 'Светлый, бирюзовый акцент, умеренные скругления. Универсальный вид.',
    swatches: {
      bg: 'oklch(0.985 0.002 90)',
      card: 'oklch(1 0 0)',
      primary: 'oklch(0.48 0.11 190)',
      accent: 'oklch(0.94 0.02 190)',
    },
    radius: '0.5rem',
    layout: 'standard',
  },
  {
    id: 'warm',
    name: 'Теплий',
    nameRu: 'Тёплый',
    description: 'Тепла палітра, помаранчевий акцент, крупні скруглення. М’який стиль.',
    descriptionRu: 'Тёплая палитра, оранжевый акцент, крупные скругления. Мягкий стиль.',
    swatches: {
      bg: 'oklch(0.99 0.012 85)',
      card: 'oklch(1 0.004 85)',
      primary: 'oklch(0.66 0.16 45)',
      accent: 'oklch(0.93 0.045 60)',
    },
    radius: '1rem',
    layout: 'standard',
  },
  {
    id: 'dark-tech',
    name: 'Dark Tech',
    nameRu: 'Dark Tech',
    description: 'Темна тема, синій акцент, гострі кути. Технологічний вигляд.',
    descriptionRu: 'Тёмная тема, синий акцент, острые углы. Технологичный вид.',
    swatches: {
      bg: 'oklch(0.19 0.02 260)',
      card: 'oklch(0.24 0.025 260)',
      primary: 'oklch(0.62 0.18 250)',
      accent: 'oklch(0.34 0.05 250)',
    },
    radius: '0.25rem',
    layout: 'standard',
  },
  {
    id: 'elegant',
    name: 'Елегантний',
    nameRu: 'Элегантный',
    description: 'Монохром із золотим акцентом, тонкі лінії. Преміальний вигляд.',
    descriptionRu: 'Монохром с золотым акцентом, тонкие линии. Премиальный вид.',
    swatches: {
      bg: 'oklch(0.975 0.003 80)',
      card: 'oklch(0.995 0.002 80)',
      primary: 'oklch(0.55 0.09 80)',
      accent: 'oklch(0.93 0.025 85)',
    },
    radius: '0.125rem',
    layout: 'standard',
  },
  {
    id: 'marketplace',
    name: 'Маркетплейс',
    nameRu: 'Маркетплейс',
    description:
      'Щільна вітрина у стилі Prom: компактний промо-банер, плитки категорій та багато товарів на екрані.',
    descriptionRu:
      'Плотная витрина в стиле Prom: компактный промо-баннер, плитки категорий и много товаров на экране.',
    swatches: {
      bg: 'oklch(0.97 0.005 250)',
      card: 'oklch(1 0 0)',
      primary: 'oklch(0.55 0.2 262)',
      accent: 'oklch(0.72 0.19 40)',
    },
    radius: '0.5rem',
    layout: 'marketplace',
    premium: true,
  },
  {
    id: 'boutique',
    name: 'Бутік',
    nameRu: 'Бутик',
    description:
      'Повноекранний editorial-банер, глибокий зелений із кремовим. Для магазинів моди та декору.',
    descriptionRu:
      'Полноэкранный editorial-баннер, глубокий зелёный с кремовым. Для магазинов моды и декора.',
    swatches: {
      bg: 'oklch(0.97 0.008 90)',
      card: 'oklch(0.99 0.005 90)',
      primary: 'oklch(0.38 0.06 155)',
      accent: 'oklch(0.85 0.06 85)',
    },
    radius: '0.75rem',
    layout: 'boutique',
    premium: true,
  },
  {
    id: 'nordic',
    name: 'Мінімал',
    nameRu: 'Минимал',
    description:
      'Чорно-білий мінімалізм із великою типографікою без банера. Максимум уваги на товари.',
    descriptionRu:
      'Чёрно-белый минимализм с крупной типографикой без баннера. Максимум внимания на товары.',
    swatches: {
      bg: 'oklch(0.99 0 0)',
      card: 'oklch(1 0 0)',
      primary: 'oklch(0.2 0 0)',
      accent: 'oklch(0.93 0 0)',
    },
    radius: '0rem',
    layout: 'minimal',
    premium: true,
  },
  {
    id: 'berry',
    name: 'Ягідний',
    nameRu: 'Ягодный',
    description:
      'Насичений ягідно-рожевий акцент на світлому тлі, м’які скруглення. Сучасний, дружній вигляд для гаджетів і аксесуарів.',
    descriptionRu:
      'Насыщенный ягодно-розовый акцент на светлом фоне, мягкие скругления. Современный, дружелюбный вид для гаджетов и аксессуаров.',
    swatches: {
      bg: 'oklch(0.98 0.006 350)',
      card: 'oklch(1 0.003 350)',
      primary: 'oklch(0.5 0.19 350)',
      accent: 'oklch(0.92 0.04 350)',
    },
    radius: '0.85rem',
    layout: 'standard',
  },
  {
    id: 'ocean',
    name: 'Океан',
    nameRu: 'Океан',
    description:
      'Глибокий синьо-бірюзовий акцент, щільна вітрина у стилі маркетплейсу. Свіжий і технологічний вигляд.',
    descriptionRu:
      'Глубокий сине-бирюзовый акцент, плотная витрина в стиле маркетплейса. Свежий и технологичный вид.',
    swatches: {
      bg: 'oklch(0.97 0.01 220)',
      card: 'oklch(1 0.004 220)',
      primary: 'oklch(0.52 0.15 220)',
      accent: 'oklch(0.85 0.08 200)',
    },
    radius: '0.5rem',
    layout: 'marketplace',
    premium: true,
  },
  {
    id: 'forest',
    name: 'Ліс',
    nameRu: 'Лес',
    description:
      'Темна смарагдово-зелена тема з повноекранним editorial-банером. Преміальний вигляд для еко- та lifestyle-брендів.',
    descriptionRu:
      'Тёмная изумрудно-зелёная тема с полноэкранным editorial-баннером. Премиальный вид для эко- и lifestyle-брендов.',
    swatches: {
      bg: 'oklch(0.16 0.02 150)',
      card: 'oklch(0.22 0.025 150)',
      primary: 'oklch(0.6 0.14 150)',
      accent: 'oklch(0.3 0.04 150)',
    },
    radius: '0.4rem',
    layout: 'boutique',
    premium: true,
  },
  {
    id: 'mint',
    name: 'Мʼята',
    nameRu: 'Мята',
    description:
      'Свіжий м’ятний фон з коралловим акцентом, велика типографіка без банера. Яскравий, молодіжний мінімалізм.',
    descriptionRu:
      'Свежий мятный фон с коралловым акцентом, крупная типографика без баннера. Яркий, молодёжный минимализм.',
    swatches: {
      bg: 'oklch(0.985 0.01 165)',
      card: 'oklch(1 0.005 165)',
      primary: 'oklch(0.72 0.13 165)',
      accent: 'oklch(0.78 0.14 30)',
    },
    radius: '1.25rem',
    layout: 'minimal',
  },

  /* ============================================================
     Niche storefront themes — ready-made designs per shop niche.
     ============================================================ */

  {
    id: 'cosmetics',
    name: 'Косметика',
    nameRu: 'Косметика',
    description:
      'Ніжна рожево-кремова палітра, мʼякі скруглення, editorial-банер. Для магазинів доглядової та декоративної косметики.',
    descriptionRu:
      'Нежная розово-кремовая палитра, мягкие скругления, editorial-баннер. Для магазинов уходовой и декоративной косметики.',
    swatches: {
      bg: 'oklch(0.985 0.008 15)',
      card: 'oklch(1 0.004 15)',
      primary: 'oklch(0.62 0.14 5)',
      accent: 'oklch(0.93 0.04 25)',
    },
    radius: '1rem',
    layout: 'boutique',
    niche: true,
    premium: true,
  },
  {
    id: 'fashion',
    name: 'Одяг',
    nameRu: 'Одежда',
    description:
      'Шикарний монохром з теракотовим акцентом, гострі лінії, editorial-банер. Для магазинів одягу та fashion-бутиків.',
    descriptionRu:
      'Шикарный монохром с терракотовым акцентом, острые линии, editorial-баннер. Для магазинов одежды и fashion-бутиков.',
    swatches: {
      bg: 'oklch(0.98 0.006 70)',
      card: 'oklch(1 0.003 70)',
      primary: 'oklch(0.3 0.04 50)',
      accent: 'oklch(0.65 0.15 40)',
    },
    radius: '0.125rem',
    layout: 'boutique',
    niche: true,
    premium: true,
  },
  {
    id: 'electronics',
    name: 'Електроніка',
    nameRu: 'Электроника',
    description:
      'Темна техно-тема з неоново-бірюзовим акцентом. Для магазинів електроніки, гаджетів та компʼютерної техніки.',
    descriptionRu:
      'Тёмная техно-тема с неоново-бирюзовым акцентом. Для магазинов электроники, гаджетов и компьютерной техники.',
    swatches: {
      bg: 'oklch(0.18 0.02 260)',
      card: 'oklch(0.23 0.025 260)',
      primary: 'oklch(0.7 0.16 230)',
      accent: 'oklch(0.3 0.06 275)',
    },
    radius: '0.5rem',
    layout: 'standard',
    niche: true,
    premium: true,
  },
  {
    id: 'autoparts',
    name: 'Автозапчастини та шини',
    nameRu: 'Автозапчасти и шины',
    description:
      'Індустріальна графітово-помаранчева тема, щільна вітрина в стилі маркетплейса. Для автозапчастин, шин та дисків.',
    descriptionRu:
      'Индустриальная графитово-оранжевая тема, плотная витрина в стиле маркетплейса. Для автозапчастей, шин и дисков.',
    swatches: {
      bg: 'oklch(0.96 0.005 240)',
      card: 'oklch(1 0 0)',
      primary: 'oklch(0.28 0.03 250)',
      accent: 'oklch(0.68 0.18 55)',
    },
    radius: '0.375rem',
    layout: 'marketplace',
    niche: true,
    premium: true,
  },
  {
    id: 'food',
    name: 'Їжа',
    nameRu: 'Еда',
    description:
      'Апетитна кремово-томатна палітра із зеленим акцентом, щільна вітрина. Для продуктів харчування та фермерських товарів.',
    descriptionRu:
      'Аппетитная кремово-томатная палитра с зелёным акцентом, плотная витрина. Для продуктов питания и фермерских товаров.',
    swatches: {
      bg: 'oklch(0.985 0.01 90)',
      card: 'oklch(1 0.004 90)',
      primary: 'oklch(0.58 0.2 25)',
      accent: 'oklch(0.7 0.16 145)',
    },
    radius: '0.75rem',
    layout: 'marketplace',
    niche: true,
    premium: true,
  },
  {
    id: 'sneakers',
    name: 'Кросівки',
    nameRu: 'Кроссовки',
    description:
      'Зухвалий стрітстайл: чорний з вольтовим лайм-акцентом, велика типографіка. Для магазинів кросівок та streetwear.',
    descriptionRu:
      'Дерзкий стритстайл: чёрный с вольтовым лайм-акцентом, крупная типографика. Для магазинов кроссовок и streetwear.',
    swatches: {
      bg: 'oklch(0.97 0.005 100)',
      card: 'oklch(1 0 0)',
      primary: 'oklch(0.2 0.01 100)',
      accent: 'oklch(0.85 0.2 130)',
    },
    radius: '0.25rem',
    layout: 'minimal',
    niche: true,
    premium: true,
  },
  {
    id: 'pharmacy',
    name: 'Аптека',
    nameRu: 'Аптека',
    description:
      'Чиста медична тема: білий з бірюзовим акцентом. Для аптек, вітамінів та товарів для здоровʼя.',
    descriptionRu:
      'Чистая медицинская тема: белый с бирюзовым акцентом. Для аптек, витаминов и товаров для здоровья.',
    swatches: {
      bg: 'oklch(0.99 0.004 200)',
      card: 'oklch(1 0 0)',
      primary: 'oklch(0.55 0.12 185)',
      accent: 'oklch(0.9 0.05 170)',
    },
    radius: '0.625rem',
    layout: 'standard',
    niche: true,
    premium: true,
  },
  {
    id: 'sport',
    name: 'Спортивні товари',
    nameRu: 'Спортивные товары',
    description:
      'Енергійна темна тема з червоно-помаранчевим акцентом, editorial-банер. Для спорттоварів та екіпірування.',
    descriptionRu:
      'Энергичная тёмная тема с красно-оранжевым акцентом, editorial-баннер. Для спорттоваров и экипировки.',
    swatches: {
      bg: 'oklch(0.16 0.015 20)',
      card: 'oklch(0.21 0.02 20)',
      primary: 'oklch(0.62 0.22 30)',
      accent: 'oklch(0.75 0.16 65)',
    },
    radius: '0.375rem',
    layout: 'boutique',
    niche: true,
    premium: true,
  },
  {
    id: 'toys',
    name: 'Дитячі іграшки',
    nameRu: 'Детские игрушки',
    description:
      'Грайлива небесно-коралова палітра, великі скруглення. Для дитячих іграшок та товарів для дітей.',
    descriptionRu:
      'Игривая небесно-коралловая палитра, большие скругления. Для детских игрушек и товаров для детей.',
    swatches: {
      bg: 'oklch(0.97 0.015 240)',
      card: 'oklch(1 0.004 240)',
      primary: 'oklch(0.65 0.18 20)',
      accent: 'oklch(0.85 0.15 95)',
    },
    radius: '1.25rem',
    layout: 'standard',
    niche: true,
    premium: true,
  },
  {
    id: 'autochem',
    name: 'Автохімія',
    nameRu: 'Автохимия',
    description:
      'Глибока нафтово-синя тема з лаймовим акцентом, щільна вітрина. Для автохімії, масел та автокосметики.',
    descriptionRu:
      'Глубокая нефте-синяя тема с лаймовым акцентом, плотная витрина. Для автохимии, масел и автокосметики.',
    swatches: {
      bg: 'oklch(0.2 0.03 250)',
      card: 'oklch(0.25 0.035 250)',
      primary: 'oklch(0.78 0.18 135)',
      accent: 'oklch(0.35 0.07 230)',
    },
    radius: '0.5rem',
    layout: 'marketplace',
    niche: true,
    premium: true,
  },
  {
    id: 'tea',
    name: 'Чай',
    nameRu: 'Чай',
    description:
      'Дзен-палітра: теплий папір, матча та глина, editorial-банер. Для чаю, кави та еко-продуктів.',
    descriptionRu:
      'Дзен-палитра: тёплая бумага, матча и глина, editorial-баннер. Для чая, кофе и эко-продуктов.',
    swatches: {
      bg: 'oklch(0.96 0.015 100)',
      card: 'oklch(0.99 0.008 100)',
      primary: 'oklch(0.5 0.1 140)',
      accent: 'oklch(0.7 0.1 60)',
    },
    radius: '0.75rem',
    layout: 'boutique',
    niche: true,
    premium: true,
  },
  {
    id: 'books',
    name: 'Книжки',
    nameRu: 'Книги',
    description:
      'Затишна бібліотечна тема: пергамент, чорнило та бордо, велика типографіка. Для книжкових магазинів.',
    descriptionRu:
      'Уютная библиотечная тема: пергамент, чернила и бордо, крупная типографика. Для книжных магазинов.',
    swatches: {
      bg: 'oklch(0.965 0.02 85)',
      card: 'oklch(0.99 0.01 85)',
      primary: 'oklch(0.32 0.05 60)',
      accent: 'oklch(0.5 0.12 15)',
    },
    radius: '0.25rem',
    layout: 'minimal',
    niche: true,
    premium: true,
  },
  {
    id: 'plumbing',
    name: 'Сантехніка',
    nameRu: 'Сантехника',
    description:
      'Чиста водно-блакитна тема з глибоким синім акцентом. Для сантехніки, кранів, ванн та опалення.',
    descriptionRu:
      'Чистая водно-голубая тема с глубоким синим акцентом. Для сантехники, кранов, ванн и отопления.',
    swatches: {
      bg: 'oklch(0.98 0.008 230)',
      card: 'oklch(1 0.003 230)',
      primary: 'oklch(0.5 0.15 240)',
      accent: 'oklch(0.8 0.1 210)',
    },
    radius: '0.75rem',
    layout: 'standard',
    niche: true,
    premium: true,
  },
  {
    id: 'home',
    name: 'Все для дому',
    nameRu: 'Всё для дома',
    description:
      'Тепла затишна палітра: крем, теракот та шавлія. Для товарів для дому, декору та текстилю.',
    descriptionRu:
      'Тёплая уютная палитра: крем, терракота и шалфей. Для товаров для дома, декора и текстиля.',
    swatches: {
      bg: 'oklch(0.975 0.012 80)',
      card: 'oklch(1 0.004 80)',
      primary: 'oklch(0.55 0.1 60)',
      accent: 'oklch(0.75 0.08 130)',
    },
    radius: '0.75rem',
    layout: 'standard',
    niche: true,
    premium: true,
  },
  {
    id: 'furniture',
    name: 'Меблі',
    nameRu: 'Мебель',
    description:
      'Благородні деревні тони з латунним акцентом, editorial-банер. Для меблів та інтерʼєрних салонів.',
    descriptionRu:
      'Благородные древесные тона с латунным акцентом, editorial-баннер. Для мебели и интерьерных салонов.',
    swatches: {
      bg: 'oklch(0.96 0.015 70)',
      card: 'oklch(0.99 0.008 70)',
      primary: 'oklch(0.35 0.06 60)',
      accent: 'oklch(0.68 0.12 75)',
    },
    radius: '0.375rem',
    layout: 'boutique',
    niche: true,
    premium: true,
  },
  {
    id: 'tools',
    name: 'Інструменти',
    nameRu: 'Инструменты',
    description:
      'Брутальна чорно-жовта тема, щільна вітрина. Для інструментів, будматеріалів та електротоварів.',
    descriptionRu:
      'Брутальная чёрно-жёлтая тема, плотная витрина. Для инструментов, стройматериалов и электротоваров.',
    swatches: {
      bg: 'oklch(0.97 0.005 90)',
      card: 'oklch(1 0 0)',
      primary: 'oklch(0.22 0.01 90)',
      accent: 'oklch(0.85 0.18 100)',
    },
    radius: '0.375rem',
    layout: 'marketplace',
    niche: true,
    premium: true,
  },
  {
    id: 'pets',
    name: 'Зоотовари',
    nameRu: 'Зоотовары',
    description:
      'Тепла грайлива палітра: помаранчевий з бірюзовим акцентом. Для зоомагазинів та товарів для тварин.',
    descriptionRu:
      'Тёплая игривая палитра: оранжевый с бирюзовым акцентом. Для зоомагазинов и товаров для животных.',
    swatches: {
      bg: 'oklch(0.98 0.01 60)',
      card: 'oklch(1 0.004 60)',
      primary: 'oklch(0.65 0.17 55)',
      accent: 'oklch(0.6 0.12 190)',
    },
    radius: '1rem',
    layout: 'standard',
    niche: true,
    premium: true,
  },
  {
    id: 'flowers',
    name: 'Квіти',
    nameRu: 'Цветы',
    description:
      'Ніжна квітково-рожева палітра із зеленим акцентом, editorial-банер. Для квіткових магазинів та флористики.',
    descriptionRu:
      'Нежная цветочно-розовая палитра с зелёным акцентом, editorial-баннер. Для цветочных магазинов и флористики.',
    swatches: {
      bg: 'oklch(0.985 0.008 330)',
      card: 'oklch(1 0.003 330)',
      primary: 'oklch(0.6 0.16 350)',
      accent: 'oklch(0.65 0.14 150)',
    },
    radius: '1rem',
    layout: 'boutique',
    niche: true,
    premium: true,
  },
  {
    id: 'jewelry',
    name: 'Ювелірні вироби',
    nameRu: 'Ювелирные изделия',
    description:
      'Розкішна темна тема із золотим акцентом, editorial-банер. Для ювелірних виробів та годинників.',
    descriptionRu:
      'Роскошная тёмная тема с золотым акцентом, editorial-баннер. Для ювелирных изделий и часов.',
    swatches: {
      bg: 'oklch(0.15 0.01 60)',
      card: 'oklch(0.2 0.015 60)',
      primary: 'oklch(0.75 0.14 85)',
      accent: 'oklch(0.85 0.08 80)',
    },
    radius: '0.25rem',
    layout: 'boutique',
    niche: true,
    premium: true,
  },
  {
    id: 'gifts',
    name: 'Подарунки',
    nameRu: 'Подарки',
    description:
      'Святкова червоно-золота палітра. Для подарунків, сувенірів та святкових товарів.',
    descriptionRu:
      'Праздничная красно-золотая палитра. Для подарков, сувениров и праздничных товаров.',
    swatches: {
      bg: 'oklch(0.98 0.01 20)',
      card: 'oklch(1 0.003 20)',
      primary: 'oklch(0.55 0.2 20)',
      accent: 'oklch(0.78 0.15 80)',
    },
    radius: '0.75rem',
    layout: 'standard',
    niche: true,
    premium: true,
  },
  {
    id: 'garden',
    name: 'Сад і город',
    nameRu: 'Сад и огород',
    description:
      'Свіжа зелена палітра з земляним акцентом. Для товарів для саду, городу та дачі.',
    descriptionRu:
      'Свежая зелёная палитра с земляным акцентом. Для товаров для сада, огорода и дачи.',
    swatches: {
      bg: 'oklch(0.97 0.015 130)',
      card: 'oklch(1 0.005 130)',
      primary: 'oklch(0.5 0.14 145)',
      accent: 'oklch(0.6 0.1 70)',
    },
    radius: '0.625rem',
    layout: 'standard',
    niche: true,
    premium: true,
  },
  {
    id: 'gaming',
    name: 'Геймінг',
    nameRu: 'Гейминг',
    description:
      'Темна неонова тема: фіолет з ціановим акцентом. Для ігрових товарів, ПК та аксесуарів.',
    descriptionRu:
      'Тёмная неоновая тема: фиолетовый с циановым акцентом. Для игровых товаров, ПК и аксессуаров.',
    swatches: {
      bg: 'oklch(0.15 0.02 290)',
      card: 'oklch(0.2 0.025 290)',
      primary: 'oklch(0.65 0.22 300)',
      accent: 'oklch(0.75 0.15 220)',
    },
    radius: '0.5rem',
    layout: 'standard',
    niche: true,
    premium: true,
  },
  {
    id: 'stationery',
    name: 'Канцелярія',
    nameRu: 'Канцелярия',
    description:
      'Паперово-біла тема з чорнильним акцентом, велика типографіка. Для канцелярії та товарів для офісу.',
    descriptionRu:
      'Бумажно-белая тема с чернильным акцентом, крупная типографика. Для канцелярии и товаров для офиса.',
    swatches: {
      bg: 'oklch(0.99 0.003 90)',
      card: 'oklch(1 0 0)',
      primary: 'oklch(0.45 0.12 260)',
      accent: 'oklch(0.7 0.15 30)',
    },
    radius: '0.5rem',
    layout: 'minimal',
    niche: true,
    premium: true,
  },
  {
    id: 'hobby',
    name: 'Хобі та творчість',
    nameRu: 'Хобби и творчество',
    description:
      'Яскрава креативна палітра: лаванда з помаранчевим акцентом. Для товарів для хобі, рукоділля та творчості.',
    descriptionRu:
      'Яркая креативная палитра: лаванда с оранжевым акцентом. Для товаров для хобби, рукоделия и творчества.',
    swatches: {
      bg: 'oklch(0.98 0.01 300)',
      card: 'oklch(1 0.004 300)',
      primary: 'oklch(0.55 0.18 300)',
      accent: 'oklch(0.72 0.16 50)',
    },
    radius: '0.875rem',
    layout: 'standard',
    niche: true,
    premium: true,
  },
  {
    id: 'appliances',
    name: 'Побутова техніка',
    nameRu: 'Бытовая техника',
    description:
      'Чиста сталево-блакитна тема, щільна вітрина. Для побутової та кліматичної техніки.',
    descriptionRu:
      'Чистая стально-голубая тема, плотная витрина. Для бытовой и климатической техники.',
    swatches: {
      bg: 'oklch(0.97 0.006 240)',
      card: 'oklch(1 0 0)',
      primary: 'oklch(0.5 0.1 245)',
      accent: 'oklch(0.8 0.09 210)',
    },
    radius: '0.5rem',
    layout: 'marketplace',
    niche: true,
    premium: true,
  },
  {
    id: 'moto',
    name: 'Мототехніка',
    nameRu: 'Мототехника',
    description:
      'Темна тема з вогняно-помаранчевим акцентом, editorial-банер. Для мототехніки та екіпірування.',
    descriptionRu:
      'Тёмная тема с огненно-оранжевым акцентом, editorial-баннер. Для мототехники и экипировки.',
    swatches: {
      bg: 'oklch(0.17 0.015 30)',
      card: 'oklch(0.22 0.02 30)',
      primary: 'oklch(0.65 0.2 50)',
      accent: 'oklch(0.5 0.05 240)',
    },
    radius: '0.375rem',
    layout: 'boutique',
    niche: true,
    premium: true,
  },
  {
    id: 'bikes',
    name: 'Велосипеди',
    nameRu: 'Велосипеды',
    description:
      'Енергійна тема: темна хвоя з лаймовим акцентом, велика типографіка. Для велосипедів та велоаксесуарів.',
    descriptionRu:
      'Энергичная тема: тёмная хвоя с лаймовым акцентом, крупная типографика. Для велосипедов и велоаксессуаров.',
    swatches: {
      bg: 'oklch(0.96 0.01 120)',
      card: 'oklch(1 0.004 120)',
      primary: 'oklch(0.3 0.08 140)',
      accent: 'oklch(0.8 0.18 130)',
    },
    radius: '0.5rem',
    layout: 'minimal',
    niche: true,
    premium: true,
  },
  {
    id: 'music',
    name: 'Музичні інструменти',
    nameRu: 'Музыкальные инструменты',
    description:
      'Атмосферна темна сцена з бурштиновим акцентом, editorial-банер. Для музичних інструментів та аудіотехніки.',
    descriptionRu:
      'Атмосферная тёмная сцена с янтарным акцентом, editorial-баннер. Для музыкальных инструментов и аудиотехники.',
    swatches: {
      bg: 'oklch(0.16 0.015 40)',
      card: 'oklch(0.21 0.02 40)',
      primary: 'oklch(0.7 0.16 70)',
      accent: 'oklch(0.55 0.18 25)',
    },
    radius: '0.375rem',
    layout: 'boutique',
    niche: true,
    premium: true,
  },
  {
    id: 'optics',
    name: 'Оптика',
    nameRu: 'Оптика',
    description:
      'Мінімалістична біла тема з лінзово-синім акцентом, велика типографіка. Для оптики, окулярів та лінз.',
    descriptionRu:
      'Минималистичная белая тема с линзово-синим акцентом, крупная типографика. Для оптики, очков и линз.',
    swatches: {
      bg: 'oklch(0.99 0 0)',
      card: 'oklch(1 0 0)',
      primary: 'oklch(0.3 0.01 240)',
      accent: 'oklch(0.6 0.14 230)',
    },
    radius: '0.25rem',
    layout: 'minimal',
    niche: true,
    premium: true,
  },
  {
    id: 'fishing',
    name: 'Рибалка і туризм',
    nameRu: 'Рыбалка и туризм',
    description:
      'Природна палітра: глибока хвоя з річковим акцентом. Для рибалки, туризму та активного відпочинку.',
    descriptionRu:
      'Природная палитра: глубокая хвоя с речным акцентом. Для рыбалки, туризма и активного отдыха.',
    swatches: {
      bg: 'oklch(0.95 0.02 120)',
      card: 'oklch(0.98 0.012 120)',
      primary: 'oklch(0.35 0.08 150)',
      accent: 'oklch(0.6 0.12 230)',
    },
    radius: '0.5rem',
    layout: 'standard',
    niche: true,
    premium: true,
  },
]

export const TEMPLATE_IDS = TEMPLATES.map((t) => t.id)

export function isTemplateId(v: string): v is TemplateId {
  return (TEMPLATE_IDS as string[]).includes(v)
}

/** Resolve a template preset by id, falling back to "classic". */
export function getTemplate(id: string): TemplatePreset {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0]
}
