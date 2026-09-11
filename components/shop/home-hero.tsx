import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Tag, Truck, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { TemplateLayout } from '@/lib/shop/templates'
import { localizedPath, type Locale } from '@/lib/i18n/config'

export type HeroContent = {
  badge: string
  heroTitle: string
  heroText: string
  toCatalog: string
  heroAlt: string
}

export type HeroCategory = {
  id: number
  name: string
  slug?: string | null
  image: string | null
}

/**
 * Home page hero. Renders a different layout depending on the active
 * storefront template, so templates differ structurally — not only in colors.
 */
const DEFAULT_HERO_IMAGE = '/hero-electronics.png'

export function HomeHero({
  layout,
  content,
  categories,
  locale = 'uk',
  imageUrl,
}: {
  layout: TemplateLayout
  content: HeroContent
  categories: HeroCategory[]
  locale?: Locale
  /** Admin-configured hero image (Настройки → Главная); empty = default. */
  imageUrl?: string
}) {
  const customImage = imageUrl?.trim() || ''
  const image = customImage || DEFAULT_HERO_IMAGE
  if (layout === 'marketplace')
    return <MarketplaceHero content={content} categories={categories} locale={locale} image={image} />
  if (layout === 'boutique') return <BoutiqueHero content={content} locale={locale} image={image} />
  if (layout === 'minimal') return <MinimalHero content={content} locale={locale} />
  return (
    <StandardHero
      content={content}
      locale={locale}
      image={customImage}
      categories={categories}
    />
  )
}

function categoryHref(cat: HeroCategory, locale: Locale) {
  return localizedPath(`/category/${cat.id}`, locale)
}

function CategoryTile({ cat, locale }: { cat: HeroCategory; locale: Locale }) {
  return (
    <Link
      href={categoryHref(cat, locale)}
      className="group flex flex-col items-center gap-2 rounded-2xl border border-border/70 bg-card p-3 text-center shadow-[0_1px_0_rgba(15,23,42,0.04)] transition-colors hover:border-primary hover:shadow-md"
    >
      <div className="relative size-14 overflow-hidden rounded-2xl bg-muted sm:size-16">
        {cat.image ? (
          <Image src={cat.image} alt="" fill sizes="64px" className="object-cover transition duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center text-lg font-semibold text-muted-foreground">
            {cat.name.charAt(0)}
          </div>
        )}
      </div>
      <span className="line-clamp-2 text-xs font-medium leading-snug text-foreground group-hover:text-primary sm:text-sm">
        {cat.name}
      </span>
    </Link>
  )
}

/* Category-first home (Prom / Rozetka): shoppers land on departments, not a stock gadget photo. */
function StandardHero({
  content: c,
  locale,
  image,
  categories,
}: {
  content: HeroContent
  locale: Locale
  image: string
  categories: HeroCategory[]
}) {
  const tiles = categories.slice(0, 12)
  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
              {c.heroTitle}
            </h1>
            <p className="mt-2 max-w-xl text-pretty text-sm text-muted-foreground sm:text-base">{c.heroText}</p>
          </div>
          <Button asChild className="shrink-0 rounded-full">
            <Link href={localizedPath('/catalog', locale)}>
              {c.toCatalog} <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
        </div>

        {image ? (
          <div className="relative mt-5 aspect-[21/9] max-h-48 overflow-hidden rounded-2xl sm:max-h-56">
            <Image src={image} alt={c.heroAlt} fill priority sizes="(max-width: 1280px) 100vw, 1280px" className="object-cover" />
          </div>
        ) : null}

        {tiles.length > 0 ? (
          <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {tiles.map((cat) => (
              <CategoryTile key={cat.id} cat={cat} locale={locale} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}

/* Prom-style: compact promo banner + dense category tile rail. */
function MarketplaceHero({
  content: c,
  categories,
  locale,
  image,
}: {
  content: HeroContent
  categories: HeroCategory[]
  locale: Locale
  image: string
}) {
  const tiles = categories.slice(0, 8)
  const benefits =
    locale === 'ru'
      ? ['Быстрая доставка по Украине', 'Гарантия на каждый товар', 'Регулярные акции и скидки']
      : ['Швидка доставка по Україні', 'Гарантія на кожен товар', 'Регулярні акції та знижки']
  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 lg:grid-cols-[2fr_1fr] lg:px-8">
        {/* Promo banner */}
        <div className="relative flex min-h-56 flex-col justify-center overflow-hidden rounded-[var(--radius)] bg-primary p-8 text-primary-foreground">
          <div className="relative z-10 max-w-md">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
              <Tag className="size-3.5" />
              {c.badge}
            </span>
            <h1 className="mt-3 text-balance text-3xl font-bold leading-tight sm:text-4xl">{c.heroTitle}</h1>
            <p className="mt-2 text-pretty text-sm opacity-90">{c.heroText}</p>
            <Button asChild size="lg" variant="secondary" className="mt-5">
              <Link href={localizedPath('/catalog', locale)}>
                {c.toCatalog} <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
          </div>
          <Image
            src={image}
            alt=""
            width={360}
            height={270}
            priority
            className="pointer-events-none absolute -right-8 top-1/2 hidden w-72 -translate-y-1/2 rounded-lg object-cover opacity-30 lg:block"
          />
        </div>
        {/* Quick benefits card */}
        <div className="hidden flex-col justify-center gap-4 rounded-[var(--radius)] border border-border bg-card p-6 lg:flex">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Truck className="size-4" />
            </span>
            <p className="text-sm font-medium text-foreground">{benefits[0]}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <ShieldCheck className="size-4" />
            </span>
            <p className="text-sm font-medium text-foreground">{benefits[1]}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Tag className="size-4" />
            </span>
            <p className="text-sm font-medium text-foreground">{benefits[2]}</p>
          </div>
        </div>
      </div>
      {/* Dense category rail */}
      {tiles.length > 0 && (
        <div className="mx-auto max-w-7xl px-4 pb-6 lg:px-8">
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            {tiles.map((cat) => (
              <Link
                key={cat.id}
                href={categoryHref(cat, locale)}
                className="group flex flex-col items-center gap-2 rounded-[var(--radius)] border border-border bg-card p-3 text-center transition-colors hover:border-primary"
              >
                <div className="relative size-12 overflow-hidden rounded-full bg-muted">
                  {cat.image ? (
                    <Image src={cat.image || '/placeholder.svg'} alt={cat.name} fill sizes="48px" className="object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm font-bold text-muted-foreground">
                      {cat.name.charAt(0)}
                    </div>
                  )}
                </div>
                <span className="line-clamp-2 text-xs font-medium text-foreground group-hover:text-primary">
                  {cat.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

/* Editorial full-width hero with overlaid text. */
function BoutiqueHero({ content: c, locale, image }: { content: HeroContent; locale: Locale; image: string }) {
  return (
    <section className="relative border-b border-border">
      <div className="relative min-h-[420px] w-full overflow-hidden lg:min-h-[520px]">
        <Image
          src={image}
          alt={c.heroAlt}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
        <div className="absolute inset-0 flex items-center">
          <div className="mx-auto w-full max-w-7xl px-4 lg:px-8">
            <div className="max-w-xl text-white">
              <span className="inline-block border-b-2 border-accent pb-1 text-sm font-medium uppercase tracking-widest">
                {c.badge}
              </span>
              <h1 className="mt-4 text-balance text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
                {c.heroTitle}
              </h1>
              <p className="mt-4 max-w-md text-pretty text-lg text-white/85">{c.heroText}</p>
              <Button asChild size="lg" className="mt-7">
                <Link href={localizedPath('/catalog', locale)}>
                  {c.toCatalog} <ArrowRight className="ml-1 size-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* Typographic hero without a photo — oversized heading, thin rules. */
function MinimalHero({ content: c, locale }: { content: HeroContent; locale: Locale }) {
  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-24">
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-muted-foreground">{c.badge}</p>
        <h1 className="mt-6 max-w-4xl text-balance text-5xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
          {c.heroTitle}
        </h1>
        <div className="mt-8 flex flex-col gap-6 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-md text-pretty text-base text-muted-foreground">{c.heroText}</p>
          <Button asChild size="lg" variant="outline" className="shrink-0 rounded-none border-foreground">
            <Link href={localizedPath('/catalog', locale)}>
              {c.toCatalog} <ArrowRight className="ml-1 size-5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
