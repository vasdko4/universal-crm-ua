import { localizedPath, type Locale } from '@/lib/i18n/config'

export type HeroSlide = {
  badge: string
  title: string
  text: string
  href: string
  cta: string
  tone: 'delivery' | 'pay' | 'warranty' | 'catalog'
}

export function defaultHeroSlides(locale: Locale, catalogCta: string): HeroSlide[] {
  const catalog = localizedPath('/catalog', locale)
  if (locale === 'ru') {
    return [
      {
        badge: 'Доставка',
        title: 'Новая Почта по всей Украине',
        text: 'Отправляем в отделение или на адрес. ТТН приходит в кабинет сразу после сборки заказа.',
        href: catalog,
        cta: catalogCta,
        tone: 'delivery',
      },
      {
        badge: 'Оплата',
        title: 'Картой онлайн или при получении',
        text: 'Оплачивайте как удобно: наложенный платёж или безопасная оплата картой на сайте.',
        href: catalog,
        cta: catalogCta,
        tone: 'pay',
      },
      {
        badge: 'Гарантия',
        title: 'Обмен и поддержка по каждому заказу',
        text: 'Пишите в кабинет или на горячую линию — поможем с размером, возвратом и статусом посылки.',
        href: catalog,
        cta: catalogCta,
        tone: 'warranty',
      },
      {
        badge: 'Акции',
        title: 'Скидки на хиты этой недели',
        text: 'Новые поступления и уценённые позиции обновляются каждый день. Смотрите актуальные цены в каталоге.',
        href: localizedPath('/catalog?discount=1', locale),
        cta: 'Смотреть акции',
        tone: 'catalog',
      },
    ]
  }
  return [
    {
      badge: 'Доставка',
      title: 'Нова Пошта по всій Україні',
      text: 'Відправляємо у відділення або на адресу. ТТН з’являється в кабінеті одразу після збірки замовлення.',
      href: catalog,
      cta: catalogCta,
      tone: 'delivery',
    },
    {
      badge: 'Оплата',
      title: 'Карткою онлайн або при отриманні',
      text: 'Платіть як зручно: наложений платіж або безпечна оплата карткою на сайті.',
      href: catalog,
      cta: catalogCta,
      tone: 'pay',
    },
    {
      badge: 'Гарантія',
      title: 'Обмін і підтримка по кожному замовленню',
      text: 'Пишіть у кабінет або на гарячу лінію — допоможемо з розміром, поверненням і статусом посилки.',
      href: catalog,
      cta: catalogCta,
      tone: 'warranty',
    },
    {
      badge: 'Акції',
      title: 'Знижки на хіти цього тижня',
      text: 'Нові надходження та уцінені позиції оновлюються щодня. Актуальні ціни — у каталозі.',
      href: localizedPath('/catalog?discount=1', locale),
      cta: 'Дивитись акції',
      tone: 'catalog',
    },
  ]
}
