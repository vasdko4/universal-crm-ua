import Link from 'next/link'
import { ArrowRight, Package } from 'lucide-react'
import type { Locale } from '@/lib/i18n/config'
import { localizedPath } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/server'
import { formatPrice } from '@/lib/shop/format'
import type { getMyOrders } from '@/app/actions/shop'
import { OrderStatusBadge, PaymentStatusBadge } from './order-status-badge'
import { SectionHeader, EmptyState } from './account-ui'
import { formatKyivDate } from './utils'

type Orders = Awaited<ReturnType<typeof getMyOrders>>

/** Compact recent-orders preview for the account dashboard. */
export function RecentOrders({ orders, locale }: { orders: Orders; locale: Locale }) {
  const t = getDictionary(locale).account
  const recent = orders.slice(0, 3)

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <SectionHeader
        title={t.recentOrdersTitle}
        action={
          <Link
            href={localizedPath('/account/orders', locale)}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {t.viewAllOrders} <ArrowRight className="size-4" />
          </Link>
        }
      />
      {recent.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t.noOrders}
          description={t.noOrdersDescription}
          className="mt-4 border-0 bg-muted/40 py-10"
          action={
            <Link
              href={localizedPath('/catalog', locale)}
              className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t.goToCatalog}
            </Link>
          }
        />
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {recent.map((o) => (
            <li key={o.id}>
              <Link
                href={localizedPath(`/account/orders/${o.id}`, locale)}
                className="group flex items-center gap-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold text-card-foreground group-hover:text-primary">
                      №{o.orderNumber}
                    </span>
                    <OrderStatusBadge status={o.status} locale={locale} />
                    <PaymentStatusBadge status={o.paymentStatus} locale={locale} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatKyivDate(o.createdAt, locale)} · {o.itemsCount} {t.itemsCountUnit}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold text-primary">
                  {formatPrice(Number(o.total), 'UAH', locale)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
