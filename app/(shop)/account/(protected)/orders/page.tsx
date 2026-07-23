import Link from 'next/link'
import Image from 'next/image'
import { Package } from 'lucide-react'
import { getMyOrders } from '@/app/actions/shop'
import { formatPrice } from '@/lib/shop/format'
import { getOrderStatusLabel } from '@/lib/order-status'
import { Button } from '@/components/ui/button'
import { getLocale, getDictionary } from '@/lib/i18n/server'

export default async function MyOrdersPage() {
  const [orders, locale] = await Promise.all([getMyOrders(), getLocale()])
  const dict = getDictionary(locale)
  const t = dict.account

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-border bg-card px-6 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted">
          <Package className="size-7 text-muted-foreground" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-card-foreground">{t.noOrders}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.noOrdersDescription}</p>
        <Button asChild className="mt-5">
          <Link href="/catalog">{t.goToCatalog}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {orders.map((o) => {
        const statusLabel = getOrderStatusLabel(o.status, locale)
        return (
          <div key={o.id} className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/account/orders/${o.id}`}
                    className="font-semibold text-card-foreground hover:text-primary"
                  >
                    №{o.orderNumber}
                  </Link>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {statusLabel}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {o.createdAt ? new Date(o.createdAt).toLocaleDateString('uk-UA') : ''} ·{' '}
                  {o.itemsCount} {t.itemsCountUnit}
                </p>
              </div>
              <div className="text-lg font-bold text-primary">{formatPrice(Number(o.total))}</div>
            </div>

            <ul className="mt-4 divide-y divide-border border-t border-border">
              {o.items.map((item) => {
                const content = (
                  <>
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                      <Image
                        src={item.image || '/placeholder.svg'}
                        alt={item.name}
                        fill
                        sizes="56px"
                        className="object-contain"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-card-foreground group-hover:text-primary">
                        {item.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.quantity} × {formatPrice(Number(item.price))}
                      </p>
                    </div>
                    <div className="text-sm font-semibold text-card-foreground">
                      {formatPrice(Number(item.total))}
                    </div>
                  </>
                )
                return (
                  <li key={item.id}>
                    {item.productId ? (
                      <Link
                        href={`/product/${item.productId}`}
                        className="group flex items-center gap-3 py-3"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 py-3">{content}</div>
                    )}
                  </li>
                )
              })}
            </ul>

            <div className="mt-4 flex justify-end">
              <Button asChild variant="outline" size="sm">
                <Link href={`/account/orders/${o.id}`}>{t.orderDetailsButton}</Link>
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
