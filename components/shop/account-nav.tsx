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
 * Mobile: sticky horizontally-scrollable tab bar pinned under the viewport top.
 * Desktop (lg+): vertical sidebar.
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
    <div className="lg:sticky lg:top-6 lg:self-start">
      <nav
        aria-label={dict.account.title}
        className="sticky top-2 z-20 flex gap-1 overflow-x-auto rounded-2xl border border-border bg-card/95 p-1.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:static lg:flex-col lg:overflow-visible lg:bg-card lg:p-2 lg:shadow-none"
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
