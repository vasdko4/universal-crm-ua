import type { Metadata } from 'next'
import Link from 'next/link'
import { Package } from 'lucide-react'
import { getMyOrders } from '@/app/actions/shop'
import { formatPrice } from '@/lib/shop/format'
import { Button } from '@/components/ui/button'
import { getLocale, getDictionary } from '@/lib/i18n/server'
import { localizedPath } from '@/lib/i18n/config'
import { SectionHeader, EmptyState } from '@/components/shop/account/account-ui'
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/shop/account/order-status-badge'
import { formatKyivDate } from '@/components/shop/account/utils'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const dict = getDictionary(locale)
  return { title: dict.account.navOrders }
}

export default async function MyOrdersPage() {
  const locale = await getLocale()
  const dict = getDictionary(locale)
  const t = dict.account
  let orders: Awaited<ReturnType<typeof getMyOrders>> = []
  let loadError = false
  try {
    orders = await getMyOrders()
  } catch (e) {
    loadError = true
    console.error('[account/orders] page failed:', e)
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <SectionHeader title={t.navOrders} description={t.ordersDescription} />

      {loadError ? (
        <EmptyState
          icon={Package}
          title={t.ordersLoadError}
          action={
            <Button asChild>
              <a href={localizedPath('/account/orders', locale)}>{t.tryAgain}</a>
            </Button>
          }
        />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t.noOrders}
          description={t.noOrdersDescription}
          action={
            <Button asChild>
              <Link href={localizedPath('/catalog', locale)}>{t.goToCatalog}</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <article
              key={o.id}
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
            >
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={localizedPath(`/account/orders/${o.id}`, locale)}
                      className="font-semibold text-card-foreground hover:text-primary"
                    >
                      №{o.orderNumber}
                    </Link>
                    <OrderStatusBadge status={o.status} locale={locale} />
                    <PaymentStatusBadge status={o.paymentStatus} locale={locale} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatKyivDate(o.createdAt, locale)} · {o.itemsCount} {t.itemsCountUnit}
                  </p>
                </div>
                <div className="text-lg font-bold text-primary">
                  {formatPrice(Number(o.total), 'UAH', locale)}
                </div>
              </div>

              <ul className="divide-y divide-border border-t border-border">
                {o.items.map((item) => {
                  const content = (
                    <>
                      <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                        {item.image ? (
                          // eslint-disable-next-line @next/next/no-img-element -- order snapshots may be off-allowlist hosts
                          <img src={item.image} alt={item.name} className="size-full object-contain" />
                        ) : (
                          <Package className="size-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-card-foreground group-hover:text-primary">
                          {item.name}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {item.quantity} × {formatPrice(Number(item.price), 'UAH', locale)}
                        </p>
                      </div>
                      <div className="shrink-0 text-sm font-semibold text-card-foreground">
                        {formatPrice(Number(item.total), 'UAH', locale)}
                      </div>
                    </>
                  )
                  return (
                    <li key={item.id}>
                      {item.productId ? (
                        <Link
                          href={localizedPath(`/product/${o.productSlugs[item.productId] ?? item.productId}`, locale)}
                          className="group flex items-center gap-3 px-4 py-3 sm:px-5"
                        >
                          {content}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-3 px-4 py-3 sm:px-5">{content}</div>
                      )}
                    </li>
                  )
                })}
              </ul>

              <div className="flex justify-end border-t border-border bg-muted/40 px-4 py-3 sm:px-5">
                <Button asChild variant="outline" size="sm">
                  <Link href={localizedPath(`/account/orders/${o.id}`, locale)}>
                    {t.orderDetailsButton}
                  </Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
