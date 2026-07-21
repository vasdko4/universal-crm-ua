'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { User, Package, Heart, MapPin, LogOut, ShieldCheck, TicketPercent } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { useI18n } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'

export function AccountNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const { dict } = useI18n()

  const LINKS = [
    { href: '/account', label: dict.account.navProfile, icon: User },
    { href: '/account/orders', label: dict.account.navOrders, icon: Package },
    { href: '/account/addresses', label: dict.account.navAddresses, icon: MapPin },
    { href: '/account/promocodes', label: dict.account.navPromos, icon: TicketPercent },
    { href: '/favorites', label: dict.account.navFavorites, icon: Heart },
  ]

  async function logout() {
    await authClient.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <nav className="flex flex-row gap-1 overflow-x-auto rounded-xl border border-border bg-card p-2 lg:flex-col lg:overflow-visible">
      {LINKS.map((l) => {
        const active = pathname === l.href
        const Icon = l.icon
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              'flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="size-4" />
            {l.label}
          </Link>
        )
      })}
      {isAdmin && (
        <a
          href="/admin"
          className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
        >
          <ShieldCheck className="size-4" />
          {dict.account.navAdmin}
        </a>
      )}
      <button
        onClick={logout}
        className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <LogOut className="size-4" />
        {dict.account.logout}
      </button>
    </nav>
  )
}
