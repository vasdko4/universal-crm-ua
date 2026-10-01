import type { Metadata } from 'next'
import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { getShopUser } from '@/lib/session'
import { getMyOrders } from '@/app/actions/shop'
import { getMyPromocodes } from '@/app/actions/customer-promos'
import { getLocale, getDictionary } from '@/lib/i18n/server'
import { localizedPath } from '@/lib/i18n/config'
import { AccountStatCards } from '@/components/shop/account/stat-cards'
import { RecentOrders } from '@/components/shop/account/recent-orders'
import { AccountQuickLinks } from '@/components/shop/account/quick-links'
import { initials } from '@/components/shop/account/utils'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const dict = getDictionary(locale)
  return { title: dict.account.title }
}

export default async function AccountDashboardPage() {
  const user = await getShopUser()
  if (!user) return null

  const locale = await getLocale()
  const dict = getDictionary(locale)
  const t = dict.account

  let orders: Awaited<ReturnType<typeof getMyOrders>> = []
  let promos: Awaited<ReturnType<typeof getMyPromocodes>> = []
  try {
    ;[orders, promos] = await Promise.all([getMyOrders(), getMyPromocodes()])
  } catch (e) {
    console.error('[account] dashboard failed to load summary:', e)
  }

  const ordersCount = orders.length
  const totalSpent = orders.reduce(
    (sum, o) => (o.status === 'cancelled' ? sum : sum + Number(o.total)),
    0,
  )
  const activePromos = promos.filter((p) => !p.usedByMe).length

  return (
    <div className="space-y-5 sm:space-y-6">
      <AccountStatCards
        ordersCount={ordersCount}
        totalSpent={totalSpent}
        activePromos={activePromos}
        locale={locale}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px] lg:gap-5">
        <RecentOrders orders={orders} locale={locale} />

        {/* Profile summary card */}
        <section className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground">
              {initials(user.name, user.email)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-card-foreground">{user.name}</p>
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">{t.navProfile}</dt>
              <dd className="truncate font-medium text-card-foreground">{user.name}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">{t.phone}</dt>
              <dd className="truncate font-medium text-card-foreground">
                {user.phone || t.notSpecified}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">{t.emailShort}</dt>
              <dd className="truncate font-medium text-card-foreground">{user.email}</dd>
            </div>
          </dl>
          <Link
            href={localizedPath('/account/profile', locale)}
            className="mt-4 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Pencil className="size-4" /> {t.editProfile}
          </Link>
        </section>
      </div>

      <AccountQuickLinks locale={locale} />
    </div>
  )
}
