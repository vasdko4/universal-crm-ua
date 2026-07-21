'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Rocket,
  Package,
  FolderTree,
  Layers,
  FileUp,
  ShoppingCart,
  ShoppingBasket,
  Users,
  Percent,
  Megaphone,
  TrendingUp,
  FileText,
  Newspaper,
  MessageSquare,
  Truck,
  CreditCard,
  BarChart3,
  Settings,
  Shield,
  ScrollText,
  Trash2,
  Search,
  ChevronRight,
  Lightbulb,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type GuideBlock =
  | { type: 'p'; text: string }
  | { type: 'steps'; items: string[] }
  | { type: 'list'; items: string[] }
  | { type: 'tip'; text: string }
  | { type: 'warn'; text: string }

type Guide = {
  id: string
  title: string
  icon: LucideIcon
  group: string
  href?: string
  blocks: GuideBlock[]
}

const GUIDES: Guide[] = [
  {
    id: 'quick-start',
    title: 'Быстрый старт: запуск магазина с нуля',
    icon: Rocket,
    group: 'Начало работы',
    blocks: [
      { type: 'p', text: 'Рекомендуемый порядок первичной настройки нового магазина. Пройдите шаги по очереди — каждый раздел подробно описан в отдельном гайде ниже.' },
      {
        type: 'steps',
        items: [
          'Настройки → Основные: укажите название магазина, валюту и график работы.',
          'Настройки → Логотип и Дизайн: загрузите логотип и выберите цветовую схему витрины.',
          'Настройки → Контакты и Соцсети: телефоны, адрес, мессенджеры — они появятся в шапке и подвале сайта.',
          'Категории: создайте дерево категорий каталога.',
          'Товары: добавьте товары вручную или через раздел Импорт (Excel/CSV).',
          'Доставка и Платежи: включите нужные способы доставки и оплаты.',
          'Настройки → Email: подключите SMTP, чтобы уходили письма о заказах.',
          'Настройки → Уведомления: включите оповещения о новых заказах (email и/или Telegram).',
          'Пользователи: смените пароль администратора и при необходимости добавьте менеджеров.',
          'Сделайте тестовый заказ на витрине и убедитесь, что он появился в разделе Заказы.',
        ],
      },
      { type: 'tip', text: 'Перед запуском рекламы настройте Google Ads (Настройки → Google Ads) — конверсии начнут засчитываться автоматически при оформлении заказа.' },
    ],
  },
  {
    id: 'products',
    title: 'Товары: добавление и управление',
    icon: Package,
    group: 'Каталог',
    href: '/admin/products',
    blocks: [
      { type: 'p', text: 'Раздел «Товары» — основа каталога. Здесь создаются карточки товаров, управляются цены, остатки и видимость на витрине.' },
      {
        type: 'steps',
        items: [
          'Нажмите «Добавить товар» и заполните название на украинском и русском языках.',
          'Укажите цену. Если товар по акции — включите «Старая цена»: на витрине появится зачёркнутая цена и бейдж скидки.',
          'Загрузите фото (первое фото — главное). Картинки автоматически сжимаются в WebP для быстрой загрузки.',
          'Выберите категории (товар может быть в нескольких) и при необходимости группу.',
          'Заполните описание и характеристики — они показываются на странице товара.',
          'Укажите наличие: «В наличии», «Под заказ» или «Нет в наличии».',
          'Сохраните. Товар сразу появится на витрине.',
        ],
      },
      { type: 'list', items: ['Поиск и фильтры вверху списка помогают быстро найти товар.', 'Переключатель активности скрывает товар с витрины без удаления.', 'Удалённые товары попадают в Корзину (раздел «Система»), откуда их можно восстановить.'] },
      { type: 'tip', text: 'Фото загружайте любого размера — система сама уменьшит их до 1600px и сконвертирует в WebP (обычно в 5–20 раз легче исходника).' },
    ],
  },
  {
    id: 'categories',
    title: 'Категории каталога',
    icon: FolderTree,
    group: 'Каталог',
    href: '/admin/categories',
    blocks: [
      { type: 'p', text: 'Категории образуют дерево каталога на витрине: они видны в меню и используются для фильтрации товаров.' },
      {
        type: 'steps',
        items: [
          'Нажмите «Добавить категорию», заполните название (украинский и русский).',
          'Для вложенной категории выберите родителя — глубина дерева не ограничена.',
          'Добавьте описание — оно выводится на странице категории и помогает SEO.',
          'Порядок категорий в меню регулируется полем сортировки.',
        ],
      },
      { type: 'warn', text: 'При удалении категории товары не удаляются — они просто теряют привязку к ней. Проверьте товары после реорганизации дерева.' },
    ],
  },
  {
    id: 'groups',
    title: 'Группы товаров',
    icon: Layers,
    group: 'Каталог',
    href: '/admin/groups',
    blocks: [
      { type: 'p', text: 'Группы объединяют товары в подборки независимо от категорий — например «Новинки», «Аксессуары к iPhone», «Подарки до 1000 грн». Группу можно выводить на витрине как отдельную подборку.' },
      {
        type: 'steps',
        items: [
          'Создайте группу и дайте ей понятное название.',
          'Добавьте товары в группу — один товар может быть в нескольких группах.',
          'Используйте группу в акциях: скидку можно применить сразу ко всей группе.',
        ],
      },
    ],
  },
  {
    id: 'import',
    title: 'Импорт товаров из файла',
    icon: FileUp,
    group: 'Каталог',
    href: '/admin/import',
    blocks: [
      { type: 'p', text: 'Массовая загрузка товаров из Excel (.xlsx) или CSV — удобно при переезде с другой платформы или загрузке прайса поставщика.' },
      {
        type: 'steps',
        items: [
          'Скачайте шаблон файла на странице импорта, чтобы увидеть требуемые колонки.',
          'Заполните файл: название, цена, категория, описание, ссылки на фото и т.д.',
          'Загрузите файл — система покажет предпросмотр и отметит ошибки в строках.',
          'Подтвердите импорт. Существующие товары можно обновлять по совпадению артикула.',
        ],
      },
      { type: 'tip', text: 'Сначала попробуйте импорт на 2–3 товарах, проверьте результат на витрине, и только потом загружайте весь прайс.' },
    ],
  },
  {
    id: 'orders',
    title: 'Заказы: обработка и статусы',
    icon: ShoppingCart,
    group: 'Продажи',
    href: '/admin/orders',
    blocks: [
      { type: 'p', text: 'Все заказы с витрины попадают в этот раздел. Здесь же можно создать заказ вручную — например, принятый по телефону.' },
      {
        type: 'steps',
        items: [
          'Новый заказ приходит со статусом «Новый». Откройте его, чтобы увидеть состав, контакты и способ доставки.',
          'Свяжитесь с покупателем и переведите заказ в «Подтверждён».',
          'После отправки укажите номер ТТН и статус «Отправлен» — покупатель получит письмо (если настроен SMTP).',
          'После получения — «Выполнен». Если покупатель отказался — «Отменён».',
        ],
      },
      { type: 'list', items: ['Кнопка «Создать заказ» позволяет оформить заказ вручную: выберите товары, укажите контакты и доставку.', 'Фильтры по статусу, дате и поиск по номеру/телефону ускоряют работу с большим потоком.', 'История изменений каждого заказа фиксируется в Логах.'] },
      { type: 'tip', text: 'Настройте уведомления (Настройки → Уведомления), чтобы мгновенно узнавать о новых заказах на email или в Telegram.' },
    ],
  },
  {
    id: 'abandoned-carts',
    title: 'Брошенные корзины: возврат покупателей',
    icon: ShoppingBasket,
    group: 'Продажи',
    href: '/admin/abandoned-carts',
    blocks: [
      { type: 'p', text: 'Если посетитель ввёл контакты на оформлении заказа, но не завершил покупку, его корзина сохраняется автоматически и появляется здесь через 30 минут.' },
      {
        type: 'steps',
        items: [
          'Откройте раздел — сводка сверху показывает открытые корзины, отправленные напоминания и потенциальную выручку.',
          'В карточке корзины видны контакты, состав и сумма.',
          'Нажмите «Напомнить письмом» — покупателю уйдёт письмо со списком товаров и ссылкой на его корзину.',
          'Если покупатель вернулся и оформил заказ, корзина автоматически помечается «Купил» с номером заказа.',
        ],
      },
      { type: 'warn', text: 'Для отправки напоминаний должен быть настроен SMTP (Настройки → Email).' },
    ],
  },
  {
    id: 'customers',
    title: 'Клиенты',
    icon: Users,
    group: 'Продажи',
    href: '/admin/customers',
    blocks: [
      { type: 'p', text: 'База покупателей собирается автоматически из заказов: контакты, количество заказов и общая сумма покупок.' },
      { type: 'list', items: ['Поиск по имени, телефону или email.', 'Карточка клиента показывает историю всех его заказов.', 'Используйте базу для выборочных акций постоянным покупателям.'] },
    ],
  },
  {
    id: 'promotions',
    title: 'Акции и промокоды',
    icon: Percent,
    group: 'Маркетинг',
    href: '/admin/promotions',
    blocks: [
      { type: 'p', text: 'Раздел «Акции» управляет скидками на товары и промокодами на оформлении заказа.' },
      {
        type: 'steps',
        items: [
          'Создайте акцию: укажите название, размер скидки (процент или фиксированная сумма) и срок действия.',
          'Выберите охват: конкретные товары, категории или группы.',
          'Активируйте — на витрине у товаров появятся акционные цены и бейджи.',
          'Для промокода задайте код (например SALE15), скидку, лимит использований и срок — покупатель вводит его на чекауте.',
        ],
      },
      { type: 'tip', text: 'Акции с ограниченным сроком мотивируют лучше бессрочных: таймер «до конца акции» отображается на витрине автоматически.' },
    ],
  },
  {
    id: 'modal-ads',
    title: 'Модальная реклама (попапы)',
    icon: Megaphone,
    group: 'Маркетинг',
    href: '/admin/modal-ads',
    blocks: [
      { type: 'p', text: 'Всплывающие окна на витрине для анонсов акций, промокодов и сбора внимания. Гибко настраиваются: где, когда и как часто показывать.' },
      {
        type: 'steps',
        items: [
          'Нажмите «Новая кампания», укажите заголовок и текст.',
          'Загрузите картинку баннера (рекомендуемая пропорция 16:9) — сжатие в WebP автоматическое.',
          'Настройте кнопку: текст, ссылку и цвет (пресеты или свой цвет — контраст текста подберётся сам).',
          'Выберите страницы показа (главная, каталог, товар, корзина) и триггер: задержка в секундах, глубина прокрутки или попытка ухода с сайта.',
          'Задайте частоту: каждый визит, раз в сессию или один раз для посетителя.',
          'Активируйте кампанию и проверьте на витрине.',
        ],
      },
      { type: 'list', items: ['Статистика кампании считает показы, клики и CTR.', 'Несколько активных кампаний показываются по очереди с учётом приоритета.'] },
      { type: 'warn', text: 'Не ставьте попап «каждый визит» с задержкой 0 секунд — это раздражает посетителей и повышает отказы. Оптимально: 5–10 секунд или прокрутка 40–60%.' },
    ],
  },
  {
    id: 'bestsellers',
    title: 'Топ продаж',
    icon: TrendingUp,
    group: 'Маркетинг',
    href: '/admin/bestsellers',
    blocks: [
      { type: 'p', text: 'Управление блоком «Топ продаж» на главной странице: какие товары показывать и в каком порядке.' },
      { type: 'list', items: ['Автоматический режим — товары подбираются по реальным продажам.', 'Ручной режим — сами выбираете и сортируете товары в блоке.'] },
    ],
  },
  {
    id: 'pages',
    title: 'Страницы сайта',
    icon: FileText,
    group: 'Контент',
    href: '/admin/pages',
    blocks: [
      { type: 'p', text: 'Статические страницы витрины: «О нас», «Доставка и оплата», «Гарантия», «Контакты» и любые другие. Ссылки на них выводятся в подвале сайта.' },
      {
        type: 'steps',
        items: [
          'Создайте страницу, укажите заголовок и URL-адрес (например /about).',
          'Наполните контент в редакторе на двух языках.',
          'Опубликуйте — страница станет доступна на витрине и попадёт в sitemap.',
        ],
      },
    ],
  },
  {
    id: 'articles',
    title: 'Статьи (блог)',
    icon: Newspaper,
    group: 'Контент',
    href: '/admin/articles',
    blocks: [
      { type: 'p', text: 'Блог магазина: обзоры, новости, подборки. Статьи индексируются поисковиками и приводят органический трафик.' },
      { type: 'list', items: ['У каждой статьи есть обложка, анонс и полный текст на двух языках.', 'Черновики не видны на витрине до публикации.', 'В статьи можно вставлять ссылки на товары и категории.'] },
      { type: 'tip', text: 'Регулярные статьи с ключевыми запросами («как выбрать …», «сравнение …») — самый дешёвый источник покупателей в долгосрочной перспективе.' },
    ],
  },
  {
    id: 'reviews',
    title: 'Отзывы и вопросы: модерация',
    icon: MessageSquare,
    group: 'Контент',
    href: '/admin/reviews',
    blocks: [
      { type: 'p', text: 'Покупатели оставляют отзывы с оценкой и задают вопросы на страницах товаров. Всё проходит модерацию — без вашего одобрения на витрине ничего не появится.' },
      {
        type: 'steps',
        items: [
          'Новые отзывы приходят со статусом «На модерации».',
          'Прочитайте и нажмите «Одобрить» (появится на витрине) или «Отклонить».',
          'На отзыв можно ответить от имени магазина — ответ виден под отзывом.',
          'На вопросы отвечайте через кнопку «Ответить» — вопрос с ответом публикуется на странице товара.',
        ],
      },
      { type: 'tip', text: 'Отвечайте даже на негативные отзывы — вежливый ответ магазина повышает доверие сильнее, чем десяток пятизвёздочных оценок.' },
    ],
  },
  {
    id: 'delivery',
    title: 'Доставка: способы и Новая Почта',
    icon: Truck,
    group: 'Логистика',
    href: '/admin/delivery',
    blocks: [
      { type: 'p', text: 'Управление способами доставки, которые видит покупатель на оформлении заказа: Новая Почта, курьер, самовывоз и другие.' },
      {
        type: 'steps',
        items: [
          'Включите нужные способы переключателями — выключенные не показываются на чекауте.',
          'Отредактируйте название, описание и стоимость каждого способа.',
          'Порядок в списке регулируется сортировкой.',
        ],
      },
      { type: 'warn', text: 'Для поиска отделений Новой Почты на чекауте нужен API-ключ: получите его в кабинете НП (Настройки → Безопасность → Создать ключ) и добавьте переменную окружения NOVA_POSHTA_API_KEY на сервере.' },
    ],
  },
  {
    id: 'payments',
    title: 'Платежи: способы оплаты и онлайн-эквайринг',
    icon: CreditCard,
    group: 'Логистика',
    href: '/admin/payments',
    blocks: [
      { type: 'p', text: 'Настройка способов оплаты (наличные, наложенный платёж, карта) и платёжных шлюзов для онлайн-оплаты.' },
      {
        type: 'steps',
        items: [
          'Включите способы оплаты, которые готовы принимать.',
          'Для онлайн-оплаты откройте настройки шлюза (например LiqPay/Monobank), вставьте ключи из кабинета платёжной системы и активируйте.',
          'Сделайте тестовый платёж и убедитесь, что заказ переходит в «Оплачен».',
        ],
      },
      { type: 'warn', text: 'Никогда не публикуйте приватные ключи шлюза. Они хранятся только на сервере и не попадают на витрину.' },
    ],
  },
  {
    id: 'statistics',
    title: 'Статистика и дашборд',
    icon: BarChart3,
    group: 'Аналитика',
    href: '/admin/statistics',
    blocks: [
      { type: 'p', text: 'Дашборд показывает сводку дня, а раздел «Статистика» — детальную аналитику: выручка, количество заказов, средний чек, топ товаров и динамика по периодам.' },
      { type: 'list', items: ['Выбирайте период: день, неделя, месяц или произвольные даты.', 'Графики помогают увидеть сезонность и эффект от акций.', 'Данные считаются по реальным заказам без учёта отменённых.'] },
    ],
  },
  {
    id: 'settings',
    title: 'Настройки магазина: все разделы',
    icon: Settings,
    group: 'Система',
    href: '/admin/settings',
    blocks: [
      { type: 'p', text: 'Центральный раздел конфигурации. Что настраивается в каждой вкладке:' },
      {
        type: 'list',
        items: [
          'Основные — название магазина, валюта, график работы (показывается на витрине).',
          'SEO — заголовок и описание сайта для поисковиков и соцсетей.',
          'Дизайн — цветовая схема витрины: выберите готовую или настройте свою.',
          'Логотип — логотип для шапки сайта и админки, фавикон.',
          'Контакты — телефоны, email, адрес: выводятся в шапке, подвале и на странице контактов.',
          'Кнопка связи — плавающая кнопка мессенджеров на витрине (Telegram, Viber, WhatsApp, телефон).',
          'Соцсети — ссылки на Instagram, Facebook и другие сети в подвале.',
          'Email — SMTP для отправки писем: хост, порт, логин, пароль. Кнопка «Отправить тест» проверяет подключение.',
          'Уведомления — оповещения о новых заказах: письмо покупателю, письмо администратору, Telegram-бот (токен от @BotFather + Chat ID).',
          'Google Ads — ID конверсии и метка для отслеживания покупок в рекламных кампаниях.',
        ],
      },
      { type: 'tip', text: 'После изменения SMTP всегда нажимайте «Отправить тест» — так вы сразу узнаете о неверном пароле или порте, а не после потерянного заказа.' },
    ],
  },
  {
    id: 'users',
    title: 'Пользователи и роли',
    icon: Shield,
    group: 'Система',
    href: '/admin/users',
    blocks: [
      { type: 'p', text: 'Управление доступом сотрудников к админ-центру. У каждого пользователя своя роль и набор разрешений — сотрудник видит только доступные ему разделы.' },
      {
        type: 'steps',
        items: [
          'Нажмите «Добавить пользователя», укажите имя, email и пароль.',
          'Выберите роль: Администратор (полный доступ), Менеджер или Контент-менеджер.',
          'Для точной настройки отметьте конкретные разделы, доступные пользователю.',
          'Сотрудник входит по своему email и паролю на странице /sign-in.',
        ],
      },
      { type: 'warn', text: 'Сразу после установки магазина смените пароль главного администратора. Не выдавайте роль «Администратор» без необходимости — для обработки заказов достаточно «Менеджера».' },
    ],
  },
  {
    id: 'logs',
    title: 'Логи действий',
    icon: ScrollText,
    group: 'Система',
    href: '/admin/logs',
    blocks: [
      { type: 'p', text: 'Журнал всех действий в админ-центре: кто вошёл, что изменил в товарах, заказах и настройках. Помогает разобраться «кто и когда это поменял».' },
      { type: 'list', items: ['Фильтры по пользователю, типу действия и дате.', 'Записи создаются автоматически — ничего настраивать не нужно.'] },
    ],
  },
  {
    id: 'trash',
    title: 'Корзина удалённых',
    icon: Trash2,
    group: 'Система',
    href: '/admin/trash',
    blocks: [
      { type: 'p', text: 'Удалённые товары, категории и другие объекты попадают сюда, а не исчезают безвозвратно.' },
      { type: 'list', items: ['«Восстановить» возвращает объект на прежнее место.', '«Удалить навсегда» стирает объект окончательно — это действие необратимо.'] },
    ],
  },
]

const TIP_STYLES = {
  tip: { icon: Lightbulb, container: 'border-primary/30 bg-primary/5', iconColor: 'text-primary' },
  warn: { icon: AlertTriangle, container: 'border-amber-500/40 bg-amber-500/10', iconColor: 'text-amber-600' },
} as const

function GuideBlockView({ block }: { block: GuideBlock }) {
  if (block.type === 'p') {
    return <p className="text-sm leading-relaxed text-muted-foreground">{block.text}</p>
  }
  if (block.type === 'steps') {
    return (
      <ol className="flex flex-col gap-2.5">
        {block.items.map((item, i) => (
          <li key={i} className="flex gap-3 text-sm leading-relaxed">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {i + 1}
            </span>
            <span className="pt-0.5 text-foreground">{item}</span>
          </li>
        ))}
      </ol>
    )
  }
  if (block.type === 'list') {
    return (
      <ul className="flex flex-col gap-1.5">
        {block.items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-border" />
            {item}
          </li>
        ))}
      </ul>
    )
  }
  const style = TIP_STYLES[block.type]
  const Icon = style.icon
  return (
    <div className={cn('flex gap-2.5 rounded-lg border p-3', style.container)}>
      <Icon className={cn('mt-0.5 size-4 shrink-0', style.iconColor)} />
      <p className="text-sm leading-relaxed text-foreground">{block.text}</p>
    </div>
  )
}

export function GuidesViewer() {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return GUIDES
    return GUIDES.filter(
      (g) =>
        g.title.toLowerCase().includes(q) ||
        g.group.toLowerCase().includes(q) ||
        g.blocks.some((b) =>
          b.type === 'p' || b.type === 'tip' || b.type === 'warn'
            ? b.text.toLowerCase().includes(q)
            : b.items.some((i) => i.toLowerCase().includes(q)),
        ),
    )
  }, [query])

  const groups = useMemo(() => {
    const map = new Map<string, Guide[]>()
    for (const g of filtered) {
      const list = map.get(g.group) ?? []
      list.push(g)
      map.set(g.group, list)
    }
    return [...map.entries()]
  }, [filtered])

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* Table of contents */}
      <nav
        aria-label="Оглавление инструкций"
        className="top-6 flex w-full shrink-0 flex-col gap-4 rounded-xl border border-border bg-card p-4 lg:sticky lg:w-64"
      >
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по инструкциям"
            className="pl-8"
            aria-label="Поиск по инструкциям"
          />
        </div>
        <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
          {groups.map(([group, items]) => (
            <div key={group} className="flex flex-col gap-0.5">
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group}
              </p>
              {items.map((g) => (
                <a
                  key={g.id}
                  href={`#${g.id}`}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <g.icon className="size-4 shrink-0" />
                  <span className="line-clamp-1">{g.title}</span>
                </a>
              ))}
            </div>
          ))}
          {groups.length === 0 && (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">Ничего не найдено</p>
          )}
        </div>
      </nav>

      {/* Guide articles */}
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        {filtered.map((guide) => (
          <article
            key={guide.id}
            id={guide.id}
            className="scroll-mt-6 rounded-xl border border-border bg-card p-5 md:p-6"
          >
            <header className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <guide.icon className="size-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{guide.group}</p>
                  <h2 className="text-lg font-semibold leading-tight text-foreground">{guide.title}</h2>
                </div>
              </div>
              {guide.href && (
                <Link
                  href={guide.href}
                  className="hidden shrink-0 items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:flex"
                >
                  Открыть раздел
                  <ChevronRight className="size-3.5" />
                </Link>
              )}
            </header>
            <div className="flex flex-col gap-4">
              {guide.blocks.map((block, i) => (
                <GuideBlockView key={i} block={block} />
              ))}
            </div>
          </article>
        ))}
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            По запросу «{query}» ничего не найдено. Попробуйте другое слово.
          </div>
        )}
      </div>
    </div>
  )
}
