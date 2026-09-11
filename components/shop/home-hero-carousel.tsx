'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronLeft, ChevronRight, CreditCard, ShieldCheck, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { localizedPath, type Locale } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'

export type HeroSlide = {
  badge: string
  title: string
  text: string
  href: string
  cta: string
  tone: 'delivery' | 'pay' | 'warranty' | 'catalog'
}

const TONE = {
  delivery: 'from-emerald-800 to-teal-700',
  pay: 'from-slate-800 to-slate-700',
  warranty: 'from-cyan-900 to-teal-800',
  catalog: 'from-stone-800 to-neutral-700',
} as const

const ICONS = {
  delivery: Truck,
  pay: CreditCard,
  warranty: ShieldCheck,
  catalog: ArrowRight,
} as const

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

export function HomeHeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const n = slides.length

  useEffect(() => {
    if (n < 2 || paused) return
    const id = window.setInterval(() => setIndex((i) => (i + 1) % n), 5500)
    return () => window.clearInterval(id)
  }, [n, paused])

  if (n === 0) return null
  const slide = slides[index]
  const Icon = ICONS[slide.tone]

  function go(delta: number) {
    setIndex((i) => (i + delta + n) % n)
  }

  return (
    <section
      className="border-b border-border bg-background"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mx-auto max-w-7xl px-4 py-4 lg:px-8 lg:py-6">
        <div className={cn('relative overflow-hidden rounded-3xl bg-gradient-to-br p-6 text-white sm:p-10 lg:p-12', TONE[slide.tone])}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">{slide.badge}</p>
          <h1 className="mt-3 max-w-2xl text-balance text-2xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            {slide.title}
          </h1>
          <p className="mt-3 max-w-xl text-pretty text-sm text-white/85 sm:text-base">{slide.text}</p>
          <Button asChild size="lg" variant="secondary" className="mt-6 rounded-full">
            <Link href={slide.href}>
              {slide.cta} <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
          <Icon className="pointer-events-none absolute -right-4 -bottom-4 size-36 opacity-15 sm:size-48" aria-hidden />

          {n > 1 ? (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                className="absolute left-3 top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-sm hover:bg-black/40 sm:flex"
                aria-label="Previous"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                className="absolute right-3 top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-sm hover:bg-black/40 sm:flex"
                aria-label="Next"
              >
                <ChevronRight className="size-5" />
              </button>
              <div className="mt-6 flex gap-2">
                {slides.map((s, i) => (
                  <button
                    key={s.title}
                    type="button"
                    onClick={() => setIndex(i)}
                    className={cn('h-1.5 rounded-full transition-all', i === index ? 'w-8 bg-white' : 'w-3 bg-white/40')}
                    aria-label={s.badge}
                    aria-current={i === index}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  )
}
