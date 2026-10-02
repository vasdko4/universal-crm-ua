import Link from 'next/link'
import { Heart, MapPin, Package, TicketPercent, User } from 'lucide-react'
import type { Locale } from '@/lib/i18n/config'
import { localizedPath } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/server'
import { SectionHeader } from './account-ui'
import { cn } from '@/lib/utils'

/** Tile shortcuts to the main account sections, shown on the dashboard. */
export function AccountQuickLinks({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).account
  const items = [
    {
      href: '/account/profile',
      label: t.navProfile,
      icon: User,
      iconClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    },
    {
      href: '/account/orders',
      label: t.navOrders,
      icon: Package,
      iconClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    },
    {
      href: '/account/addresses',
      label: t.navAddresses,
      icon: MapPin,
      iconClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    },
    {
      href: '/account/promocodes',
      label: t.navPromos,
      icon: TicketPercent,
      iconClass: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    },
    {
      href: '/account/favorites',
      label: t.navFavorites,
      icon: Heart,
      iconClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    },
  ]

  return (
    <section>
      <SectionHeader title={t.quickAccessTitle} className="mb-3" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 sm:gap-4">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={localizedPath(item.href, locale)}
              className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div
                className={cn(
                  'flex size-11 items-center justify-center rounded-xl transition-transform group-hover:scale-105',
                  item.iconClass,
                )}
              >
                <Icon className="size-5" />
              </div>
              <span className="text-sm font-medium text-card-foreground group-hover:text-primary">
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
