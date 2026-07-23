import type { Metadata } from 'next'
import { CartView } from '@/components/shop/cart-view'
import { getLocale, getDictionary } from '@/lib/i18n/server'
import { getPublicStoreSettings } from '@/app/actions/settings-store'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const dict = getDictionary(locale)
  return {
    title: dict.cart.title,
    // Cart is a transactional page — never index it.
    robots: { index: false, follow: false },
  }
}

export default async function CartPage() {
  const locale = await getLocale()
  const dict = getDictionary(locale)
  const settings = await getPublicStoreSettings()
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:py-12">
      <h1 className="mb-6 text-2xl font-bold text-foreground md:text-3xl">{dict.cart.title}</h1>
      <CartView minOrder={settings.minOrder} />
    </div>
  )
}
