import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { TemplateLayout } from '@/lib/shop/templates'
import { localizedPath, type Locale } from '@/lib/i18n/config'
import { HomeHeroCarousel } from '@/components/shop/home-hero-carousel'
import { defaultHeroSlides } from '@/lib/shop/home-hero-slides'

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
  locale = 'uk',
  imageUrl,
}: {
  layout: TemplateLayout
  content: HeroContent
  categories?: HeroCategory[]
  locale?: Locale
  /** Admin-configured hero image (Настройки → Главная); empty = default. */
  imageUrl?: string
}) {
  const customImage = imageUrl?.trim() || ''
  const image = customImage || DEFAULT_HERO_IMAGE
  if (layout === 'boutique') return <BoutiqueHero content={content} locale={locale} image={image} />
  if (layout === 'minimal') return <MinimalHero content={content} locale={locale} />
  return <HomeHeroCarousel slides={defaultHeroSlides(locale, content.toCatalog)} />
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
