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
 * Mobile: all sections visible at once as a 3-column grid — no horizontal
 * scrolling, no cut-off labels ("Мої замов…" was the complaint). Tabs wrap
 * to two lines when a label is long; the bar scrolls away with the page
 * (a 2-row sticky bar would eat ~170px of the screen together with the
 * site header). Desktop (lg+): vertical sidebar, pinned under the header
 * (sticky top 128px = ~112px header + 16px gap).
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
      'flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-center text-[13px] font-medium transition-colors lg:justify-start lg:gap-2 lg:whitespace-nowrap lg:px-3 lg:text-sm',
      active
        ? 'bg-primary text-primary-foreground shadow-sm'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
    )

  return (
    <div className="min-w-0 lg:sticky lg:top-[128px] lg:w-[220px] lg:self-start">
      <nav
        aria-label={dict.account.title}
        className="grid grid-cols-3 gap-1 rounded-2xl border border-border bg-card/95 p-1.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:flex lg:flex-col lg:overflow-visible lg:bg-card lg:p-2 lg:shadow-none"
      >
        {LINKS.map((l) => {
          const Icon = l.icon
          return (
            <Link key={l.href} href={lp(l.href)} className={tabClass(isActive(l.href, l.exact))}>
              <Icon className="size-4 shrink-0" />
              <span className="leading-tight">{l.label}</span>
            </Link>
          )
        })}
        {isAdmin && (
          <Link
            href="/admin"
            className="flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-center text-[13px] font-medium text-primary transition-colors hover:bg-primary/10 lg:justify-start lg:gap-2 lg:whitespace-nowrap lg:px-3 lg:text-sm"
          >
            <ShieldCheck className="size-4 shrink-0" />
            <span className="leading-tight">{dict.account.navAdmin}</span>
          </Link>
        )}
        <button
          type="button"
          onClick={logout}
          className="col-span-3 flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive lg:col-span-1 lg:mt-1 lg:justify-start lg:gap-2 lg:border-t lg:border-border lg:px-3 lg:pt-3 lg:text-sm"
        >
          <LogOut className="size-4 shrink-0" />
          {dict.account.logout}
        </button>
      </nav>
    </div>
  )
}
