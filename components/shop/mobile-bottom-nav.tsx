'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, LayoutGrid, ShoppingCart, Heart, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/client'
import { localizedPath, stripLocalePrefix } from '@/lib/i18n/config'
import { useCart } from '@/lib/shop/cart-context'
import { useFavorites } from '@/lib/shop/favorites-context'
import { AuthDialog } from '@/components/shop/auth/auth-dialog'
import { useSession } from '@/lib/auth-client'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { CatalogCategoriesMobile } from '@/components/shop/catalog-categories-mobile'
import type { HeaderCategory } from '@/components/shop/site-header'

/**
 * Fixed bottom navigation bar for mobile (Prom.ua style): Home, Catalog, Cart,
 * Favorites and Account. The "Catalog" item navigates to the catalog page,
 * which on mobile shows the categories & subcategories directory. Hidden on
 * desktop where the top nav / mega-menu is used instead.
 *
 * Rendered as a sibling of the header (not inside it) because the header uses
 * `backdrop-blur`, which creates a containing block that would otherwise trap
 * this `fixed` bar inside the header instead of the viewport.
 */
export function MobileBottomNav({
  googleAuthEnabled = false,
  categories = [],
}: {
  googleAuthEnabled?: boolean
  categories?: HeaderCategory[]
}) {
  const { dict, locale } = useI18n()
  const lp = (p: string) => localizedPath(p, locale)
  const { count: cartCount, setDrawerOpen } = useCart()
  const { count: favCount } = useFavorites()
  const pathname = usePathname()
  const [categoriesOpen, setCategoriesOpen] = useState(false)

  // Close the categories sheet whenever navigation happens (link tapped).
  useEffect(() => {
    setCategoriesOpen(false)
  }, [pathname])
  const { data: session, isPending } = useSession()
  const isLoggedIn = Boolean(session?.user)
  // The session state differs between SSR and the first client render, which
  // would cause a hydration mismatch (server renders a link, client renders
  // the dialog trigger). Render the link until mounted, then switch.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Compare against the un-prefixed pathname so /ru/... routes still match
  // the same (unprefixed) href patterns used below.
  const innerPathname = stripLocalePrefix(pathname)
  const isActive = (href: string) =>
    href === '/' ? innerPathname === '/' : innerPathname.startsWith(href)

  const itemClass = (active: boolean) =>
    cn(
      'flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium transition-colors',
      active ? 'text-primary' : 'text-muted-foreground',
    )

  const badge = (n: number) =>
    n > 0 ? (
      <span className="absolute -right-2 -top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
        {n}
      </span>
    ) : null

  return (
    <>
      {/* Spacer so page content is never hidden behind the fixed bar */}
      <div className="h-16 lg:hidden" aria-hidden="true" />

      {/* Dim layer for the categories panel: ends above the bottom nav so
          the nav buttons stay visible and tappable (Prom-style). Tapping it
          counts as an outside interaction and closes the panel. */}
      {categoriesOpen ? (
        <div
          className="fixed inset-x-0 top-0 bottom-16 z-40 bg-black/50 lg:hidden"
          aria-hidden="true"
        />
      ) : null}

      <nav
        className="fixed inset-x-0 bottom-0 z-50 flex items-stretch border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label={dict.nav.menu}
      >
        <Link href={lp('/')} className={itemClass(isActive('/'))}>
          <Home className="size-5" />
          <span>{dict.common.home}</span>
        </Link>

        {/* Catalog opens a Prom-style dropdown panel from the top: it takes
            only part of the screen (up to the bottom nav) and never covers
            the nav buttons. Falls back to the catalog page link when no
            categories were passed. */}
        {categories.length > 0 ? (
          <Sheet open={categoriesOpen} onOpenChange={setCategoriesOpen} modal={false}>
            <SheetTrigger asChild>
              <button
                type="button"
                className={itemClass(
                  innerPathname.startsWith('/catalog') || innerPathname.startsWith('/category'),
                )}
              >
                <LayoutGrid className="size-5" />
                <span>{dict.nav.categories}</span>
              </button>
            </SheetTrigger>
            <SheetContent
              side="top"
              onOpenAutoFocus={(e) => e.preventDefault()}
              className="bottom-auto flex max-h-[calc(100dvh-4.5rem)] flex-col rounded-b-2xl p-0"
            >
              <SheetHeader className="border-b border-border px-4 py-3">
                <SheetTitle className="text-base">{dict.nav.categories}</SheetTitle>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3">
                <CatalogCategoriesMobile categories={categories} locale={locale} className="flex flex-col gap-3" />
              </div>
            </SheetContent>
          </Sheet>
        ) : (
          <Link
            href={lp('/catalog')}
            className={itemClass(
              innerPathname.startsWith('/catalog') || innerPathname.startsWith('/category'),
            )}
          >
            <LayoutGrid className="size-5" />
            <span>{dict.nav.categories}</span>
          </Link>
        )}

        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className={itemClass(false)}
          aria-label={dict.common.cart}
        >
          <span className="relative">
            <ShoppingCart className="size-5" />
            {badge(cartCount)}
          </span>
          <span>{dict.common.cart}</span>
        </button>

        <Link href={lp('/favorites')} className={itemClass(isActive('/favorites'))}>
          <span className="relative">
            <Heart className="size-5" />
            {badge(favCount)}
          </span>
          <span>{dict.favorites.title}</span>
        </Link>

        {!mounted || isLoggedIn || isPending ? (
          <Link href={lp('/account')} className={itemClass(isActive('/account'))}>
            <User className="size-5" />
            <span>{dict.common.account}</span>
          </Link>
        ) : (
          <AuthDialog googleEnabled={googleAuthEnabled}>
            <button type="button" className={itemClass(false)} aria-label={dict.common.account}>
              <User className="size-5" />
              <span>{dict.common.account}</span>
            </button>
          </AuthDialog>
        )}
      </nav>
    </>
  )
}
