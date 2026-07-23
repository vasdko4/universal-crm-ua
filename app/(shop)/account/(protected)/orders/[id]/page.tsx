import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { ArrowLeft, User, Phone, Mail, Truck, MapPin, Package } from 'lucide-react'
import { getMyOrderDetail } from '@/app/actions/shop'
import { formatPrice } from '@/lib/shop/format'
import { getOrderStatusLabel, getPaymentStatusLabel, getDeliveryMethodLabel } from '@/lib/order-status'
import { OrderReceiptSection } from '@/components/orders/order-receipt-section'
import { getLocale, getDictionary } from '@/lib/i18n/server'

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="break-words text-sm font-medium text-card-foreground">{value}</p>
      </div>
    </div>
  )
}

export default async function MyOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [data, locale] = await Promise.all([getMyOrderDetail(Number(id)), getLocale()])
  if (!data) notFound()
  const { order, items, receipt } = data
  const dict = getDictionary(locale)
  const t = dict.account

  const status = getOrderStatusLabel(order.status, locale)
  const pay = getPaymentStatusLabel(order.paymentStatus, locale)
  const deliveryLabel = getDeliveryMethodLabel(order.deliveryMethod, locale)

  return (
    <div className="space-y-5">
      <Link
        href="/account/orders"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" /> {t.backToOrders}
      </Link>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-card-foreground">
            {t.orderHeading}
            {order.orderNumber}
          </h2>
          <div className="flex gap-2 text-xs">
            <span className="rounded-full bg-muted px-3 py-1 font-medium text-muted-foreground">
              {status}
            </span>
            <span className="rounded-full bg-muted px-3 py-1 font-medium text-muted-foreground">
              {pay}
            </span>
          </div>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {order.createdAt ? new Date(order.createdAt).toLocaleString('uk-UA') : ''}
        </p>
      </div>

      {/* Recipient & delivery details */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-2 text-base font-semibold text-card-foreground">{t.recipientAndDelivery}</h3>
        <div className="grid gap-x-6 sm:grid-cols-2">
          {order.trackingNumber ? (
            <InfoRow
              icon={Package}
              label={t.trackingNumber}
              value={
                <span className="font-mono tracking-wide text-primary">{order.trackingNumber}</span>
              }
            />
          ) : (
            <InfoRow
              icon={Package}
              label={t.trackingNumber}
              value={<span className="text-muted-foreground">{t.notShippedYet}</span>}
            />
          )}

          {order.customerName ? (
            <InfoRow icon={User} label={t.recipientName} value={order.customerName} />
          ) : null}

          {order.customerPhone ? (
            <InfoRow
              icon={Phone}
              label={t.phone}
              value={
                <a href={`tel:${order.customerPhone}`} className="hover:text-primary">
                  {order.customerPhone}
                </a>
              }
            />
          ) : null}

          {order.customerEmail ? (
            <InfoRow
              icon={Mail}
              label={t.emailShort}
              value={
                <a href={`mailto:${order.customerEmail}`} className="hover:text-primary">
                  {order.customerEmail}
                </a>
              }
            />
          ) : null}

          <InfoRow icon={Truck} label={t.deliveryMethod} value={deliveryLabel} />

          {order.deliveryCity || order.deliveryBranch || order.deliveryAddress ? (
            <InfoRow
              icon={MapPin}
              label={t.shippedTo}
              value={
                <>
                  {order.deliveryCity ? <span>{order.deliveryCity}</span> : null}
                  {order.deliveryBranch ? (
                    <span className="block text-muted-foreground">{order.deliveryBranch}</span>
                  ) : null}
                  {order.deliveryAddress && order.deliveryAddress !== order.deliveryBranch ? (
                    <span className="block text-muted-foreground">{order.deliveryAddress}</span>
                  ) : null}
                </>
              }
            />
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <ul className="divide-y divide-border">
          {items.map((it) => {
            const body = (
              <>
                <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                  <Image
                    src={it.image || '/placeholder.svg'}
                    alt={it.name}
                    fill
                    sizes="56px"
                    className="object-contain"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-card-foreground group-hover:text-primary">
                    {it.name}
                  </p>
                  {it.variantLabel ? (
                    <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-card-foreground">
                      {it.variantLabel}
                    </span>
                  ) : null}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {it.quantity} × {formatPrice(Number(it.price))}
                  </p>
                </div>
                <span className="text-sm font-semibold text-card-foreground">
                  {formatPrice(Number(it.total))}
                </span>
              </>
            )
            return (
              <li key={it.id}>
                {it.productId ? (
                  <Link
                    href={`/product/${it.productId}`}
                    className="group flex items-center gap-3 px-5 py-3"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 px-5 py-3">{body}</div>
                )}
              </li>
            )
          })}
        </ul>
        {Number(order.discountTotal) > 0 && (
          <div className="flex items-center justify-between border-t border-border px-5 pt-4 text-sm">
            <span className="text-muted-foreground">
              {t.discount}
              {order.promoCode ? ` (${order.promoCode})` : ''}
            </span>
            <span className="font-medium text-primary">−{formatPrice(Number(order.discountTotal))}</span>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border px-5 py-4">
          <span className="font-semibold text-card-foreground">{t.grandTotal}</span>
          <span className="text-lg font-bold text-primary">{formatPrice(Number(order.total))}</span>
        </div>
      </div>

      {receipt && (
        <OrderReceiptSection
          storeName={receipt.storeName}
          orderNumber={order.orderNumber}
          createdAt={order.createdAt}
          items={items.map((i) => ({
            name: i.name,
            variantLabel: i.variantLabel,
            sku: i.sku,
            price: Number(i.price),
            quantity: i.quantity,
            total: Number(i.total),
          }))}
          itemsTotal={Number(order.itemsTotal)}
          discountTotal={Number(order.discountTotal)}
          deliveryCost={Number(order.deliveryCost)}
          total={Number(order.total)}
          currency={order.currency}
          isFiscal={receipt.isFiscal}
          qrDataUrl={receipt.qrDataUrl}
        />
      )}
    </div>
  )
}
