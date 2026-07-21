import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Truck, ShieldCheck, CreditCard, Headphones } from 'lucide-react'
import { ProductCard } from '@/components/shop/product-card'
import { HomeHero } from '@/components/shop/home-hero'
import { getTemplate } from '@/lib/shop/templates'
import { InfiniteProducts } from '@/components/shop/infinite-products'
import { JsonLd } from '@/components/shop/json-ld'
import {
  getPopularProducts,
  getDiscountedProducts,
  getShopCategories,
  getCatalogProducts,
} from '@/lib/shop/queries'
import { getStoreSettingsInternal } from '@/lib/store-settings'
import { getServerDictionary } from '@/lib/i18n/server'
import { localizedPath } from '@/lib/i18n/config'
import { getCanonicalSiteUrl, toAbsolute } from '@/lib/seo'

export const dynamic = 'force-dynamic'

const HOME_CONTENT = {
  uk: {
    badge: 'Преміум електроніка',
    heroTitle: 'Техніка, яка працює на вас',
    heroText:
      'Смартфони, навушники, аудіо та аксесуари від перевірених брендів. Доставка по всій Україні та гарантія на кожен товар.',
    toCatalog: 'Перейти до каталогу',
    heroAlt: 'Електроніка',
    categories: 'Категорії',
    popular: 'Популярні товари',
    discounts: 'Знижки',
    allProducts: 'Усі товари',
    viewAll: 'Дивитися всі',
    noPhoto: 'Немає фото',
    benefits: [
      { title: 'Швидка доставка', text: 'Нова Пошта та Укрпошта по всій Україні' },
      { title: 'Гарантія якості', text: 'Офіційна гарантія на всі товари' },
      { title: 'Зручна оплата', text: 'Накладений платіж або онлайн' },
      { title: 'Підтримка 24/7', text: "Завжди на зв'язку та готові допомогти" },
    ],
  },
  ru: {
    badge: 'Премиум электроника',
    heroTitle: 'Техника, которая работает на вас',
    heroText:
      'Смартфоны, наушники, аудио и аксессуары от проверенных брендов. Доставка по всей Украине и гарантия на каждый товар.',
    toCatalog: 'Перейти в каталог',
    heroAlt: 'Электроника',
    categories: 'Категории',
    popular: 'Популярные товары',
    discounts: 'Скидки',
    allProducts: 'Все товары',
    viewAll: 'Смотреть все',
    noPhoto: 'Нет фото',
    benefits: [
      { title: 'Быстрая доставка', text: 'Нова Пошта и Укрпошта по всей Украине' },
      { title: 'Гарантия качества', text: 'Официальная гарантия на все товары' },
      { title: 'Удобная оплата', text: 'Наложенный платёж или онлайн' },
      { title: 'Поддержка 24/7', text: 'Всегда на связи и готовы помочь' },
    ],
  },
} as const

export default async function HomePage() {
  const { locale } = await getServerDictionary()
  const c = HOME_CONTENT[locale]
  const allProductsParams = { sort: 'popular' as const, page: 1, perPage: 12, locale }
  const [popular, discounted, categories, settings, allProducts] = await Promise.all([
    getPopularProducts(8, locale),
    getDiscountedProducts(4, locale),
    getShopCategories(locale),
    getStoreSettingsInternal().catch(() => null),
    getCatalogProducts(allProductsParams),
  ])
  const topCategories = categories.filter((cat) => !cat.parentId).slice(0, 8)
  const template = getTemplate(settings?.activeTemplate ?? 'classic')

  // Admin-configured hero content (Настройки → Главная страница) overrides
  // the built-in defaults per field; empty values fall back to HOME_CONTENT.
  const heroOverride = settings?.homeHero?.[locale]
  const hero = {
    badge: heroOverride?.badge?.trim() || c.badge,
    heroTitle: heroOverride?.title?.trim() || c.heroTitle,
    heroText: heroOverride?.text?.trim() || c.heroText,
    toCatalog: heroOverride?.buttonText?.trim() || c.toCatalog,
    heroAlt: c.heroAlt,
  }
  const heroImageUrl = settings?.homeHero?.imageUrl?.trim() || undefined

  const benefitIcons = [Truck, ShieldCheck, CreditCard, Headphones]
  const benefits = c.benefits.map((b, i) => ({ ...b, icon: benefitIcons[i] }))

  const storeName = settings?.storeName || 'Интернет-магазин электроники'
  const lp = (path: string) => localizedPath(path, locale)
  const siteUrl = await getCanonicalSiteUrl()
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: storeName,
      url: siteUrl,
      logo: toAbsolute(siteUrl, settings?.logoUrl || '/hero-electronics.png'),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: storeName,
      url: siteUrl,
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${siteUrl}/catalog?search={search_term_string}` },
        'query-input': 'required name=search_term_string',
      },
    },
  ]

  return (
    <div>
      <JsonLd data={structuredData} />
      {/* Hero — layout depends on the active storefront template */}
      <HomeHero
        layout={template.layout}
        content={hero}
        imageUrl={heroImageUrl}
        categories={topCategories.map((cat) => ({ id: cat.id, name: cat.name, image: cat.image }))}
        locale={locale}
      />

      {/* Benefits */}
      <section className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {benefits.map((b) => (
            <div key={b.title} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <b.icon className="size-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{b.title}</h3>
                <p className="text-xs text-muted-foreground">{b.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories (marketplace layout already shows them in the hero rail) */}
      {template.layout !== 'marketplace' && topCategories.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
          <h2 className="mb-5 text-2xl font-bold tracking-tight text-foreground">{c.categories}</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {topCategories.map((c) => (
              <Link
                key={c.id}
                href={lp(`/category/${c.id}`)}
                className="group flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-5 text-center transition-colors hover:border-primary"
              >
                <div className="relative size-16 overflow-hidden rounded-full bg-muted">
                  {c.image ? (
                    <Image src={c.image || "/placeholder.svg"} alt={c.name} fill sizes="64px" className="object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-lg font-bold text-muted-foreground">
                      {c.name.charAt(0)}
                    </div>
                  )}
                </div>
                <span className="text-sm font-medium text-foreground group-hover:text-primary">{c.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Popular */}
      {popular.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              <Link href={lp('/catalog?popular=1')} className="hover:text-primary">
                {c.popular}
              </Link>
            </h2>
            <Link href={lp('/catalog?popular=1')} className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              {c.viewAll} <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {popular.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Discounts */}
      {discounted.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">{c.discounts}</h2>
            <Link href={lp('/catalog')} className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              {c.viewAll} <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {discounted.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* All products — infinite scroll */}
      {allProducts.items.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
          <h2 className="mb-5 text-2xl font-bold tracking-tight text-foreground">{c.allProducts}</h2>
          <InfiniteProducts
            initialItems={allProducts.items}
            total={allProducts.total}
            params={allProductsParams}
          />
        </section>
      )}
    </div>
  )
}
