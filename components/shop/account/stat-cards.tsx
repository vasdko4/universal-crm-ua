import Link from 'next/link'
import { ChevronRight, Package, TicketPercent, Wallet } from 'lucide-react'
import type { Locale } from '@/lib/i18n/config'
import { localizedPath } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/server'
import { formatPrice } from '@/lib/shop/format'
import { cn } from '@/lib/utils'

function StatCard({
  href,
  icon: Icon,
  iconClass,
  value,
  label,
}: {
  href: string
  icon: typeof Package
  iconClass: string
  value: string
  label: string
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-5"
    >
      <div
        className={cn(
          'flex size-12 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset',
          iconClass,
        )}
      >
        <Icon className="size-6" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-2xl font-bold tracking-tight text-card-foreground">{value}</p>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">{label}</p>
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  )
}

/** Dashboard summary cards: order count, total purchase sum, active promo codes. */
export function AccountStatCards({
  ordersCount,
  totalSpent,
  activePromos,
  locale,
}: {
  ordersCount: number
  totalSpent: number
  activePromos: number
  locale: Locale
}) {
  const t = getDictionary(locale).account
  return (
    <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
      <StatCard
        href={localizedPath('/account/orders', locale)}
        icon={Package}
        iconClass="bg-blue-500/10 text-blue-600 ring-blue-500/20 dark:text-blue-400"
        value={String(ordersCount)}
        label={t.statOrders}
      />
      <StatCard
        href={localizedPath('/account/orders', locale)}
        icon={Wallet}
        iconClass="bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400"
        value={formatPrice(totalSpent, 'UAH', locale)}
        label={t.statTotalSpent}
      />
      <StatCard
        href={localizedPath('/account/promocodes', locale)}
        icon={TicketPercent}
        iconClass="bg-violet-500/10 text-violet-600 ring-violet-500/20 dark:text-violet-400"
        value={String(activePromos)}
        label={t.statActivePromos}
      />
    </div>
  )
}
