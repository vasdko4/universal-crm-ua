'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  ChevronRight,
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
 * A plain vertical list on all sizes — one full-width row per section,
 * icon left, label on one line, chevron right (mobile). The 3-column grid
 * from 3.4.99 wrapped labels mid-phrase ("Мої / замовлення") and looked
 * ragged; the list cannot wrap and matches the desktop sidebar, which
 * was already a list. The bar scrolls away with the page (a sticky bar
 * would eat too much screen). Desktop (lg+): same list, pinned under the
 * header (sticky top 171px = 155px header + 16px gap; header measured live
 * on powerfox.shop: 43px utility bar + 69px main row + 43px nav row).
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
      'flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors lg:py-2 lg:text-sm',
      active
        ? 'bg-primary text-primary-foreground shadow-sm'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
    )

  return (
    <div className="min-w-0 lg:sticky lg:top-[171px] lg:w-[220px] lg:self-start">
      <nav
        aria-label={dict.account.title}
        className="flex flex-col gap-0.5 rounded-2xl border border-border bg-card p-1.5 shadow-sm lg:p-2 lg:shadow-none"
      >
        {LINKS.map((l) => {
          const Icon = l.icon
          return (
            <Link key={l.href} href={lp(l.href)} className={tabClass(isActive(l.href, l.exact))}>
              <Icon className="size-4 shrink-0" />
              {l.label}
              <ChevronRight className="ml-auto size-4 shrink-0 opacity-50 lg:hidden" />
            </Link>
          )
        })}
        {isAdmin && (
          <Link
            href="/admin"
            className="flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-[15px] font-medium text-primary transition-colors hover:bg-primary/10 lg:py-2 lg:text-sm"
          >
            <ShieldCheck className="size-4 shrink-0" />
            {dict.account.navAdmin}
            <ChevronRight className="ml-auto size-4 shrink-0 opacity-50 lg:hidden" />
          </Link>
        )}
        <button
          type="button"
          onClick={logout}
          className="mt-1 flex items-center gap-2.5 whitespace-nowrap rounded-xl border-t border-border px-3 pt-2.5 pb-2 text-[15px] font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive lg:py-2 lg:text-sm lg:pt-3"
        >
          <LogOut className="size-4 shrink-0" />
          {dict.account.logout}
        </button>
      </nav>
    </div>
  )
}
