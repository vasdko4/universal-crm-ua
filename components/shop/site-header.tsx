'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ShoppingCart, User, Phone, Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CartDrawer } from '@/components/shop/cart-drawer'
import { SearchBox } from '@/components/shop/search-box'
import { CategoryMegaMenu } from '@/components/shop/category-mega-menu'
import { LocaleSwitcher } from '@/components/shop/locale-switcher'
import { AuthDialog } from '@/components/shop/auth/auth-dialog'
import { useSession } from '@/lib/auth-client'
import { useCart } from '@/lib/shop/cart-context'
import { useFavorites } from '@/lib/shop/favorites-context'
import { useI18n } from '@/lib/i18n/client'
import { localizedPath } from '@/lib/i18n/config'
import { useIsClient } from '@/lib/hooks/use-client-only'

export type HeaderCategory = {
  id: number
  name: string
  slug: string
  parentId: number | null
  image?: string | null
}

export function SiteHeader({
  storeName,
  logoUrl,
  phone,
  categories,
  googleAuthEnabled = false,
}: {
  storeName: string
  logoUrl: string | null
  phone: string | null
  categories: HeaderCategory[]
  googleAuthEnabled?: boolean
}) {
  const { count } = useCart()
  const { count: favCount } = useFavorites()
  const { dict, locale } = useI18n()
  const lp = (p: string) => localizedPath(p, locale)
  const { data: session, isPending } = useSession()
  const isLoggedIn = Boolean(session?.user)
  // The session state differs between SSR and the first client render, which
  // would cause a hydration mismatch (server renders a link, client renders
  // the dialog trigger). Render the link until mounted, then switch.
  const mounted = useIsClient()

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 lg:px-8">
        {/* Logo */}
        <Link href={lp('/')} className="flex shrink-0 items-center gap-2">
          {logoUrl ? (
            <Image src={logoUrl || "/placeholder.svg"} alt={storeName} width={140} height={36} className="h-9 w-auto object-contain" />
          ) : (
            <span className="text-xl font-bold tracking-tight text-foreground">{storeName}</span>
          )}
        </Link>

        {/* Catalog mega-menu (desktop) */}
        <div className="hidden lg:block">
          <CategoryMegaMenu categories={categories} />
        </div>

        {/* Search */}
        <div className="flex-1">
          <SearchBox />
        </div>

        {/* Actions */}
        <div className="ml-auto flex items-center gap-1">
          {phone && (
            <a
              href={`tel:${phone}`}
              className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-accent xl:flex"
            >
              <Phone className="size-4" />
              {phone}
            </a>
          )}
          <div className="hidden lg:block">
            <LocaleSwitcher />
          </div>
          <Button variant="ghost" size="icon" className="relative hidden lg:inline-flex" asChild aria-label={dict.favorites.title}>
            <Link href={lp('/favorites')}>
              <Heart className="size-5" />
              {favCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                  {favCount}
                </span>
              )}
            </Link>
          </Button>
          {!mounted || isLoggedIn || isPending ? (
            <Button variant="ghost" size="icon" className="hidden lg:inline-flex" asChild aria-label={dict.nav.account}>
              <Link href={lp('/account')}>
                <User className="size-5" />
              </Link>
            </Button>
          ) : (
            <AuthDialog googleEnabled={googleAuthEnabled}>
              <Button variant="ghost" size="icon" className="hidden lg:inline-flex" aria-label={dict.nav.account}>
                <User className="size-5" />
              </Button>
            </AuthDialog>
          )}
          <CartDrawer>
            <Button variant="ghost" size="icon" className="relative hidden lg:inline-flex" aria-label={dict.nav.cart}>
              <ShoppingCart className="size-5" />
              {count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                  {count}
                </span>
              )}
            </Button>
          </CartDrawer>
        </div>
      </div>

      {/* Desktop primary nav */}
      <nav className="hidden border-t border-border lg:block">
        <div className="mx-auto flex max-w-7xl items-center gap-1 px-4 lg:px-8">
          <Link
            href={lp('/catalog')}
            className="border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-foreground hover:border-primary hover:text-primary"
          >
            {dict.nav.allProducts}
          </Link>
          <Link
            href={lp('/catalog?discount=1')}
            className="border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-primary hover:border-primary"
          >
            {dict.nav.promotions}
          </Link>
          <Link
            href={lp('/articles')}
            className="border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-foreground hover:border-primary hover:text-primary"
          >
            {dict.nav.articles}
          </Link>
        </div>
      </nav>

    </header>
  )
}
