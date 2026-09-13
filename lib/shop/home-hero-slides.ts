import { localizedPath, type Locale } from '@/lib/i18n/config'
import type { HomeHeroSlide } from '@/lib/store-settings'

export type HeroSlide = {
  badge: string
  title: string
  text: string
  href: string
  cta: string
  tone: 'delivery' | 'pay' | 'warranty' | 'catalog'
  image: string
}

export function defaultHeroSlides(locale: Locale, catalogCta: string): HeroSlide[] {
  const catalog = localizedPath('/catalog', locale)
  const images = {
    delivery: '/images/hero-delivery.jpg',
    pay: '/images/hero-payment.jpg',
    warranty: '/images/hero-warranty.jpg',
    catalog: '/images/hero-sales.jpg',
  }
  if (locale === 'ru') {
    return [
      {
        badge: 'Доставка',
        title: 'Новая Почта и Укрпочта по всей Украине',
        text: 'Отделение, почтомат или адрес. Выбираете перевозчика на оформлении — ТТН приходит в кабинет после сборки.',
        href: catalog,
        cta: catalogCta,
        tone: 'delivery',
        image: images.delivery,
      },
      {
        badge: 'Оплата',
        title: 'Картой онлайн или при получении',
        text: 'Наложенный платёж или безопасная оплата картой на сайте — как удобнее.',
        href: catalog,
        cta: catalogCta,
        tone: 'pay',
        image: images.pay,
      },
      {
        badge: 'Гарантия',
        title: 'Обмен и поддержка по каждому заказу',
        text: 'Поможем с размером, возвратом и статусом посылки — в кабинете или на линии.',
        href: catalog,
        cta: catalogCta,
        tone: 'warranty',
        image: images.warranty,
      },
      {
        badge: 'Акции',
        title: 'Скидки на хиты этой недели',
        text: 'Новые поступления и уценка обновляются каждый день. Актуальные цены — в каталоге.',
        href: localizedPath('/catalog?discount=1', locale),
        cta: 'Смотреть акции',
        tone: 'catalog',
        image: images.catalog,
      },
    ]
  }
  return [
    {
      badge: 'Доставка',
      title: 'Нова Пошта та Укрпошта по всій Україні',
      text: 'Відділення, поштомат або адреса. Перевізника обираєте на оформленні — ТТН з’являється в кабінеті після збірки.',
      href: catalog,
      cta: catalogCta,
      tone: 'delivery',
      image: images.delivery,
    },
    {
      badge: 'Оплата',
      title: 'Карткою онлайн або при отриманні',
      text: 'Наложений платіж або безпечна оплата карткою на сайті — як зручніше.',
      href: catalog,
      cta: catalogCta,
      tone: 'pay',
      image: images.pay,
    },
    {
      badge: 'Гарантія',
      title: 'Обмін і підтримка по кожному замовленню',
      text: 'Допоможемо з розміром, поверненням і статусом посилки — у кабінеті або на лінії.',
      href: catalog,
      cta: catalogCta,
      tone: 'warranty',
      image: images.warranty,
    },
    {
      badge: 'Акції',
      title: 'Знижки на хіти цього тижня',
      text: 'Нові надходження та уцінка оновлюються щодня. Актуальні ціни — у каталозі.',
      href: localizedPath('/catalog?discount=1', locale),
      cta: 'Дивитись акції',
      tone: 'catalog',
      image: images.catalog,
    },
  ]
}

/** Overlay admin-edited slide copy/images on the built-in carousel. */
export function resolveHeroSlides(
  locale: Locale,
  catalogCta: string,
  stored: HomeHeroSlide[] | undefined | null,
): HeroSlide[] {
  const defaults = defaultHeroSlides(locale, catalogCta)
  if (!stored || stored.length === 0) return defaults
  return defaults.map((d, i) => {
    const s = stored[i]
    if (!s) return d
    const loc = locale === 'ru' ? s.ru : s.uk
    const pick = (value: string | undefined, fallback: string) => {
      const v = value?.trim()
      return v ? v : fallback
    }
    return {
      ...d,
      badge: pick(loc?.badge, d.badge),
      title: pick(loc?.title, d.title),
      text: pick(loc?.text, d.text),
      cta: pick(loc?.cta, d.cta),
      image: pick(s.image, d.image),
      href: pick(s.href, d.href),
    }
  })
}
