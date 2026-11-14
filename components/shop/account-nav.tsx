'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Heart,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  ShieldCheck,
  TicketPercent,
  User,
} from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { useI18n } from '@/lib/i18n/client'
import { localizedPath, stripLocalePrefix } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'

/**
 * Account navigation.
 * Mobile: horizontally-scrollable tab bar pinned under the sticky site
 * header while scrolling. Desktop (lg+): vertical sidebar, also pinned
 * under the header.
 *
 * The STICKY element is the wrapper div, not the <nav>: on mobile the
 * wrapper is a direct block child of the (tall) account container, so it
 * can stick while the page scrolls; the <nav> inside it is short and could
 * not stick on its own (its containing block would be its own height).
 * The parent in (protected)/layout.tsx is therefore a plain block on
 * mobile and only becomes a grid on lg.
 *
 * Offsets are the measured sticky header heights: mobile header is 61px
 * (py-2 16px + h-11 search field 44px + 1px border), desktop header is
 * ~112px (top row ~68px + nav row ~44px) + 16px gap = 128px.
 */
export function AccountNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const { dict, locale } = useI18n()
  const lp = (p: string) => localizedPath(p, locale)

  const LINKS = [
    { href: '/account', label: dict.account.navDashboard, icon: LayoutDashboard, exact: true },
    { href: '/account/profile', label: dict.account.navProfile, icon: User, exact: false },
    { href: '/account/orders', label: dict.account.navOrders, icon: Package, exact: false },
    { href: '/account/addresses', label: dict.account.navAddresses, icon: MapPin, exact: false },
    { href: '/account/promocodes', label: dict.account.navPromos, icon: TicketPercent, exact: false },
    { href: '/account/favorites', label: dict.account.navFavorites, icon: Heart, exact: false },
  ]

  const current = stripLocalePrefix(pathname)
  const isActive = (href: string, exact: boolean) =>
    exact ? current === href : current === href || current.startsWith(href + '/')

  async function logout() {
    await authClient.signOut()
    router.push(lp('/'))
    router.refresh()
  }

  const tabClass = (active: boolean) =>
    cn(
      'flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-colors',
      active
        ? 'bg-primary text-primary-foreground shadow-sm'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
    )

  return (
    <div className="sticky top-[61px] z-30 min-w-0 lg:top-[128px] lg:w-[220px] lg:self-start">
      <nav
        aria-label={dict.account.title}
        className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-card/95 p-1.5 shadow-sm backdrop-blur [-webkit-overflow-scrolling:touch] [scrollbar-width:thin] supports-[backdrop-filter]:bg-card/80 lg:flex-col lg:overflow-visible lg:bg-card lg:p-2 lg:shadow-none"
      >
        {LINKS.map((l) => {
          const Icon = l.icon
          return (
            <Link key={l.href} href={lp(l.href)} className={tabClass(isActive(l.href, l.exact))}>
              <Icon className="size-4 shrink-0" />
              {l.label}
            </Link>
          )
        })}
        {isAdmin && (
          <Link
            href="/admin"
            className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
          >
            <ShieldCheck className="size-4 shrink-0" />
            {dict.account.navAdmin}
          </Link>
        )}
        <button
          type="button"
          onClick={logout}
          className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive lg:mt-1 lg:border-t lg:border-border lg:pt-3"
        >
          <LogOut className="size-4 shrink-0" />
          {dict.account.logout}
        </button>
      </nav>
    </div>
  )
}
