import { redirect } from 'next/navigation'
import { getLocale } from '@/lib/i18n/server'

/** Legacy alias: nothing links to /wishlist anymore (the tab points to /favorites). */
export default async function WishlistRedirectPage() {
  const locale = await getLocale()
  redirect(locale === 'ru' ? '/ru/favorites' : '/favorites')
}
