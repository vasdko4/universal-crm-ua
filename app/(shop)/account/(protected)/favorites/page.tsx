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

/**
 * Favorites inside the account area — the account nav used to point at the
 * standalone /favorites page, which navigated the shopper out of the cabinet.
 * The public /favorites route stays for guests (localStorage favorites).
 */
export default async function AccountFavoritesPage() {
  const locale = await getLocale()
  const dict = getDictionary(locale)
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground md:text-3xl">{dict.favorites.title}</h1>
      <FavoritesGrid />
    </div>
  )
}
