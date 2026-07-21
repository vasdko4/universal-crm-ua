import type { Metadata } from 'next'
import { FavoritesGrid } from '@/components/shop/favorites-grid'
import { getLocale, getDictionary } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const dict = getDictionary(locale)
  return {
    title: dict.favorites.title,
    robots: { index: false, follow: false },
  }
}

export default async function FavoritesPage() {
  const locale = await getLocale()
  const dict = getDictionary(locale)
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:py-12">
      <h1 className="mb-6 text-2xl font-bold text-foreground md:text-3xl">{dict.favorites.title}</h1>
      <FavoritesGrid />
    </div>
  )
}
