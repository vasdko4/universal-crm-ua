import type { Metadata } from 'next'
import Link from 'next/link'
import { BadgePercent } from 'lucide-react'
import { ProductCard } from '@/components/shop/product-card'
import { PromoTimer } from '@/components/shop/promo-timer'
import { JsonLd } from '@/components/shop/json-ld'
import { getActivePromotions, getPromotionProducts, toListingCard } from '@/lib/shop/queries'
import { getServerDictionary } from '@/lib/i18n/server'
import { localizedPath } from '@/lib/i18n/config'
import { getCanonicalSiteUrl, buildBreadcrumbLd } from '@/lib/seo'
import { formatPrice } from '@/lib/shop/format'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const { locale, dict } = await getServerDictionary()
  return {
    title: dict.nav.promotions,
    description:
      locale === 'ru'
        ? 'Активные скидки магазина: автоматические скидки на товары, группы и весь каталог. Скидка по акции применяется при оформлении заказа.'
        : 'Активні знижки магазину: автоматичні знижки на товари, групи та весь каталог. Знижка за акцією застосовується при оформленні замовлення.',
    alternates: {
      canonical: localizedPath('/promotions', locale),
      languages: {
        uk: '/promotions',
        ru: localizedPath('/promotions', 'ru'),
        'x-default': '/promotions',
      },
    },
  }
}

const PROMOTIONS_CONTENT = {
  uk: {
    subtitle:
      'Активні автоматичні знижки магазину. Знижка за акцією застосовується при оформленні замовлення.',
    emptyTitle: 'Акцій зараз немає',
    emptyText: 'Слідкуйте за оновленнями — нові акції зʼявляються регулярно.',
    viewAllDiscounts: 'Дивитися всі товари зі знижками',
    endsPrefix: 'до',
    noEnd: 'Безстрокова акція',
    toCatalog: 'До каталогу',
  },
  ru: {
    subtitle:
      'Активные автоматические скидки магазина. Скидка по акции применяется при оформлении заказа.',
    emptyTitle: 'Акций сейчас нет',
    emptyText: 'Следите за обновлениями — новые акции появляются регулярно.',
    viewAllDiscounts: 'Смотреть все товары со скидками',
    endsPrefix: 'до',
    noEnd: 'Бессрочная акция',
    toCatalog: 'В каталог',
  },
} as const

export default async function PromotionsPage() {
  const { locale, dict } = await getServerDictionary()
  const c = PROMOTIONS_CONTENT[locale]
  const lp = (path: string) => localizedPath(path, locale)
  const siteUrl = await getCanonicalSiteUrl()
  const dateFmt = new Intl.DateTimeFormat(locale === 'ru' ? 'ru-UA' : 'uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const promotions = await getActivePromotions()
  const withProducts = (
    await Promise.all(
      promotions.map(async (promo) => ({
        promo,
        products: await getPromotionProducts(promo, 8, locale),
      })),
    )
  ).filter(({ products }) => products.length > 0)

  const breadcrumbLd = buildBreadcrumbLd(
    [
      { name: dict.common.home, path: lp('/') },
      { name: dict.nav.promotions, path: lp('/promotions') },
    ],
    siteUrl,
  )

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 lg:px-8 lg:py-8">
      <JsonLd data={[breadcrumbLd]} />
      <nav className="mb-3 hidden text-sm text-muted-foreground lg:block">
        <Link href={lp('/')} className="hover:text-primary">
          {dict.common.home}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{dict.nav.promotions}</span>
      </nav>
      <h1 className="mb-2 text-xl font-bold tracking-tight text-foreground lg:text-3xl">
        {dict.nav.promotions}
      </h1>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground lg:text-base">{c.subtitle}</p>

      {withProducts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-lg font-semibold text-foreground">{c.emptyTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{c.emptyText}</p>
          <Link
            href={lp('/catalog')}
            className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
          >
            {c.toCatalog}
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {withProducts.map(({ promo, products }) => (
            <section
              key={promo.id}
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
            >
              <div className="border-b border-border bg-muted/50 px-4 py-4 sm:px-6">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <BadgePercent className="size-4" />
                  </span>
                  <h2 className="min-w-0 flex-1 text-lg font-bold tracking-tight text-foreground">
                    {promo.name}
                  </h2>
                  <span className="rounded bg-destructive px-2 py-1 text-sm font-bold text-destructive-foreground">
                    {promo.discountType === 'percentage'
                      ? `−${promo.discountValue}%`
                      : `−${formatPrice(promo.discountValue, 'UAH', locale)}`}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {promo.endsAt
                    ? `${c.endsPrefix} ${dateFmt.format(new Date(promo.endsAt))}`
                    : c.noEnd}
                </p>
                {promo.endsAt && (
                  <div className="mt-3">
                    <PromoTimer endsAt={promo.endsAt} label={dict.product.promoTimerLabel} locale={locale} />
                  </div>
                )}
              </div>
              {products.length > 0 && (
                <div className="p-4 sm:p-6">
                  <div className="product-grid">
                    {products.map((p) => (
                      <ProductCard key={p.id} product={toListingCard(p)} />
                    ))}
                  </div>
                </div>
              )}
              <div className="border-t border-border px-4 py-3 sm:px-6">
                <Link
                  href={lp('/catalog?discount=1')}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {c.viewAllDiscounts} →
                </Link>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
