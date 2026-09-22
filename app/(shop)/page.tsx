import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Truck, ShieldCheck, CreditCard, Headphones } from 'lucide-react'
import { ProductCard } from '@/components/shop/product-card'
import { HomeHero } from '@/components/shop/home-hero'
import { resolveHeroSlides } from '@/lib/shop/home-hero-slides'
import { getTemplate } from '@/lib/shop/templates'
import { InfiniteProducts } from '@/components/shop/infinite-products'
import { JsonLd } from '@/components/shop/json-ld'
import {
  getPopularProducts,
  getDiscountedProducts,
  getShopCategories,
  getCatalogProducts,
  toListingCard,
} from '@/lib/shop/queries'
import { getStoreSettingsInternal } from '@/lib/store-settings'
import { getServerDictionary } from '@/lib/i18n/server'
import { localizedPath } from '@/lib/i18n/config'
import { getCanonicalSiteUrl, toAbsolute } from '@/lib/seo'
import { isProxiedMedia } from '@/lib/shop/own-image-url'

export const dynamic = 'force-dynamic'

const HOME_CONTENT = {
  uk: {
    badge: 'Магазин',
    heroTitle: 'Доставка, оплата і гарантія — без сюрпризів',
    heroText:
      'Нова Пошта та Укрпошта по Україні, картка або наложка, підтримка по кожному замовленню.',
    toCatalog: 'До каталогу',
    heroAlt: 'Каталог товарів',
    // The page's single h1 (prefixed with the store name). Slide headlines are
    // h2 so the homepage has exactly one top-level heading.
    pageHeading: 'інтернет-магазин електроніки та аксесуарів з доставкою по Україні',
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
    badge: 'Магазин',
    heroTitle: 'Доставка, оплата и гарантия — без сюрпризов',
    heroText:
      'Новая Почта и Укрпочта по Украине, карта или наложенный платёж, поддержка по каждому заказу.',
    toCatalog: 'В каталог',
    heroAlt: 'Каталог товаров',
    // The page's single h1 (prefixed with the store name). Slide headlines are
    // h2 so the homepage has exactly one top-level heading.
    pageHeading: 'интернет-магазин электроники и аксессуаров с доставкой по Украине',
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
  // Plain out-of-stock products never show up on the homepage — only in
  // the catalog/search page, where they're sorted to the bottom instead.
  // Above-the-fold budget: the homepage used to server-render 12 popular + 12
  // discounted + 24 "all products" cards (~48 cards, ~75 images, ~543 KB of
  // HTML) before a shopper scrolled anywhere. Each block now ships one short
  // row and the rest arrives through "Показати ще" (server pagination).
  const HOME_ROW_SIZE = 8
  const HOME_CATALOG_PAGE_SIZE = 12
  const allProductsParams = {
    sort: 'popular' as const,
    page: 1,
    perPage: HOME_CATALOG_PAGE_SIZE,
    locale,
    hideOutOfStock: true as const,
  }
  const [popular, discounted, categories, settings, allProducts] = await Promise.all([
    getPopularProducts(HOME_ROW_SIZE, locale),
    getDiscountedProducts(HOME_ROW_SIZE, locale),
    getShopCategories(locale),
    getStoreSettingsInternal().catch(() => null),
    getCatalogProducts(allProductsParams),
  ])
  const topCategories = categories.filter((cat) => !cat.parentId).slice(0, 12)
  const template = getTemplate(settings?.activeTemplate ?? 'classic')

  // Admin-configured hero content (Настройки → Главная страница) overrides
  // the built-in defaults per field; empty values fall back to HOME_CONTENT.
  const heroOverride = settings?.homeHero?.[locale]
  const cannedHero = new Set([
    'Преміум електроніка',
    'Премиум электроника',
    'Техніка, яка працює на вас',
    'Техника, которая работает на вас',
    'Перейти до каталогу',
    'Перейти в каталог',
  ])
  const pickHero = (value: string | undefined, fallback: string) => {
    const v = value?.trim()
    if (!v || cannedHero.has(v) || /смартфон|наушник|навушник|преміум електрон|премиум электрон/i.test(v)) {
      return fallback
    }
    return v
  }
  const hero = {
    badge: pickHero(heroOverride?.badge, c.badge),
    heroTitle: pickHero(heroOverride?.title, c.heroTitle),
    heroText: pickHero(heroOverride?.text, c.heroText),
    toCatalog: pickHero(heroOverride?.buttonText, c.toCatalog),
    heroAlt: c.heroAlt,
  }
  const rawHeroImage = settings?.homeHero?.imageUrl?.trim() || ''
  const heroImageUrl =
    rawHeroImage && !/hero-electronics/i.test(rawHeroImage) ? rawHeroImage : undefined

  // Admin-configured benefit cards (Настройки → Главная страница) override
  // the built-in defaults per field; empty title/text fall back to
  // HOME_CONTENT so a fresh install (or partially filled admin form) still
  // shows complete cards.
  const benefitIcons = [Truck, ShieldCheck, CreditCard, Headphones]
  const benefitOverrides = settings?.homeBenefits?.[locale]
  const benefits = c.benefits.map((b, i) => ({
    title: benefitOverrides?.[i]?.title?.trim() || b.title,
    text: benefitOverrides?.[i]?.text?.trim() || b.text,
    icon: benefitIcons[i],
    iconUrl: benefitOverrides?.[i]?.iconUrl?.trim() || '',
  }))

  // Listing grids only need card fields — drop descriptions, galleries,
  // option axes and variant rows from the homepage payload.
  const popularCards = popular.map(toListingCard)
  const discountedCards = discounted.map(toListingCard)
  const allProductCards = allProducts.items.map(toListingCard)

  const storeName = settings?.storeName || 'Інтернет-магазин'
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
      {/* The homepage's only h1: what this shop is and what it offers. Hero
          slides and section titles are h2 (they used to each render an h1,
          which left the page with several competing top-level headings). */}
      <h1 className="mx-auto max-w-7xl px-3 pt-3 text-sm font-semibold tracking-tight text-foreground sm:px-4 sm:pt-4 sm:text-base lg:px-8">
        {storeName} — {c.pageHeading}
      </h1>
      {/* Hero — layout depends on the active storefront template */}
      <HomeHero
        layout={template.layout}
        content={hero}
        imageUrl={heroImageUrl}
        slides={resolveHeroSlides(locale, hero.toCatalog, settings?.homeHero?.slides)}
        categories={topCategories.map((cat) => ({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          image: cat.image,
        }))}
        locale={locale}
      />

      {/* Benefits — one compact row on mobile, 4-col grid on desktop */}
      <section className="mx-auto max-w-7xl px-3 py-3 sm:px-4 lg:px-8 lg:py-10">
        <div className="-mx-3 flex flex-nowrap gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden">
          {benefits.map((b) => (
            <div key={b.title} className="flex min-w-[210px] shrink-0 items-center gap-2.5 rounded-2xl border border-border/70 bg-card/80 p-3 shadow-[0_1px_0_rgba(15,23,42,0.04)] sm:min-w-0 sm:items-start sm:gap-3 sm:p-4">
              <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-primary sm:size-10">
                {b.iconUrl ? (
                  <Image src={b.iconUrl} alt={b.title} width={40} height={40} unoptimized={isProxiedMedia(b.iconUrl)} className="size-full object-cover" />
                ) : (
                  <b.icon className="size-4 sm:size-5" />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-xs font-semibold text-foreground sm:text-sm">{b.title}</h3>
                <p className="line-clamp-1 text-[11px] text-muted-foreground sm:line-clamp-none sm:text-xs">{b.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Popular */}
      {popularCards.length > 0 && (
        <section className="mx-auto max-w-7xl px-3 py-4 sm:px-4 lg:px-8 lg:py-8">
          <div className="mb-4 flex items-center justify-between lg:mb-5">
            <h2 className="text-lg font-bold tracking-tight text-foreground lg:text-2xl">
              <Link href={lp('/catalog?popular=1')} className="hover:text-primary">
                {c.popular}
              </Link>
            </h2>
            <Link href={lp('/catalog?popular=1')} className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              {c.viewAll} <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="product-grid">
            {popularCards.map((p, i) => (
              // Only the first row is eager: everything below the fold is
              // lazy-loaded by next/image.
              <ProductCard key={p.id} product={p} priority={i < 4} />
            ))}
          </div>
        </section>
      )}

      {/* Discounts */}
      {discountedCards.length > 0 && (
        <section className="mx-auto max-w-7xl px-3 py-4 sm:px-4 lg:px-8 lg:py-8">
          <div className="mb-4 flex items-center justify-between lg:mb-5">
            <h2 className="text-lg font-bold tracking-tight text-foreground lg:text-2xl">{c.discounts}</h2>
            <Link href={lp('/catalog')} className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              {c.viewAll} <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="product-grid">
            {discountedCards.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* All products — infinite scroll */}
      {allProductCards.length > 0 && (
        <section className="mx-auto max-w-7xl px-3 py-4 sm:px-4 lg:px-8 lg:py-8">
          <h2 className="mb-4 text-lg font-bold tracking-tight text-foreground lg:mb-5 lg:text-2xl">{c.allProducts}</h2>
          <InfiniteProducts
            initialItems={allProductCards}
            total={allProducts.total}
            params={allProductsParams}
          />
        </section>
      )}
    </div>
  )
}
