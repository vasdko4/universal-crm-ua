import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CheckCircle2, Package, Truck, CreditCard, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getOrderByNumber } from '@/app/actions/shop'
import { formatPrice } from '@/lib/shop/format'
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  ORDER_STATUS_LABELS_UK,
  PAYMENT_STATUS_LABELS_UK,
} from '@/lib/order-status'
import { CopyRequisites } from '@/components/shop/copy-requisites'
import { GoogleAdsPurchase } from '@/components/shop/google-ads'
import { getStoreSettingsInternal } from '@/lib/store-settings'
import { getLocale } from '@/lib/i18n/server'

const T = {
  uk: {
    title: 'Замовлення №{n} оформлено',
    thanks:
      "Дякуємо за покупку! Ми надіслали деталі на вашу пошту. Менеджер зв'яжеться з вами для підтвердження.",
    status: 'Статус',
    payment: 'Оплата',
    delivery: 'Доставка',
    requisites: 'Реквізити для оплати',
    composition: 'Склад замовлення',
    toPay: 'До сплати',
    continueShopping: 'Продовжити покупки',
    myOrders: 'Мої замовлення',
  },
  ru: {
    title: 'Заказ №{n} оформлен',
    thanks:
      'Спасибо за покупку! Мы отправили детали на вашу почту. Менеджер свяжется с вами для подтверждения.',
    status: 'Статус',
    payment: 'Оплата',
    delivery: 'Доставка',
    requisites: 'Реквизиты для оплаты',
    composition: 'Состав заказа',
    toPay: 'К оплате',
    continueShopping: 'Продолжить покупки',
    myOrders: 'Мои заказы',
  },
}

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>
}) {
  const { orderNumber } = await params
  const [data, settings, locale] = await Promise.all([
    getOrderByNumber(orderNumber),
    getStoreSettingsInternal().catch(() => null),
    getLocale(),
  ])
  if (!data) notFound()
  const { order, items } = data
  const gads = settings?.googleAds
  const t = locale === 'ru' ? T.ru : T.uk

  const statusLabel =
    locale === 'ru'
      ? (ORDER_STATUSES.find((s) => s.value === order.status)?.label ?? order.status)
      : (ORDER_STATUS_LABELS_UK[order.status] ?? order.status)
  const payLabel =
    locale === 'ru'
      ? (PAYMENT_STATUSES.find((s) => s.value === order.paymentStatus)?.label ??
        order.paymentStatus)
      : (PAYMENT_STATUS_LABELS_UK[order.paymentStatus] ?? order.paymentStatus)

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {(gads?.enabled && gads.conversionId && gads.conversionLabel) || (gads?.gaEnabled && gads.gaMeasurementId) ? (
        <GoogleAdsPurchase
          conversionId={gads?.enabled ? gads.conversionId : undefined}
          conversionLabel={gads?.enabled ? gads.conversionLabel : undefined}
          gaId={gads?.gaEnabled ? gads.gaMeasurementId : undefined}
          orderNumber={order.orderNumber}
          value={Number(order.total)}
          currency="UAH"
          items={items.map((it) => ({
            id: it.productId ?? 0,
            name: it.name,
            price: Number(it.price),
            quantity: it.quantity,
            sku: it.sku,
          }))}
          enhancedConversions={gads?.enhancedConversionsEnabled ?? false}
          customerEmail={order.customerEmail}
          customerPhone={order.customerPhone}
        />
      ) : null}
      <div className="flex flex-col items-center text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="size-9 text-primary" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-balance sm:text-3xl">
          {t.title.replace('{n}', order.orderNumber)}
        </h1>
        <p className="mt-2 max-w-md text-pretty text-muted-foreground">{t.thanks}</p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Package className="size-4" /> {t.status}
          </div>
          <p className="mt-1 font-semibold text-card-foreground">{statusLabel}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <CreditCard className="size-4" /> {t.payment}
          </div>
          <p className="mt-1 font-semibold text-card-foreground">{payLabel}</p>
        </div>
      </div>

      {order.deliveryAddress ? (
        <div className="mt-4 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Truck className="size-4" /> {t.delivery}
          </div>
          <p className="mt-1 text-card-foreground">{order.deliveryAddress}</p>
        </div>
      ) : null}

      {order.note && order.note.startsWith('Реквизиты') ? (
        <div className="mt-4 rounded-xl border border-border bg-card p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Copy className="size-4" /> {t.requisites}
          </div>
          <CopyRequisites text={order.note.replace(/^Реквизиты для оплаты:\n/, '')} />
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3 text-sm font-semibold text-card-foreground">
          {t.composition}
        </div>
        <ul className="divide-y divide-border">
          {items.map((it) => {
            const content = (
              <>
                <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                  {it.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={it.image || '/placeholder.svg'}
                      alt={it.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <Package className="size-6 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-card-foreground">{it.name}</p>
                  {it.variantLabel ? (
                    <p className="truncate text-xs text-muted-foreground">{it.variantLabel}</p>
                  ) : null}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatPrice(Number(it.price))} × {it.quantity}
                    {it.sku ? ` · ${it.sku}` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-card-foreground">
                  {formatPrice(Number(it.total))}
                </span>
              </>
            )
            return (
              <li key={it.id}>
                {it.productId ? (
                  <Link
                    href={`/product/${it.productId}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/50"
                  >
                    {content}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 px-5 py-3">{content}</div>
                )}
              </li>
            )
          })}
        </ul>
        <div className="flex items-center justify-between border-t border-border px-5 py-4">
          <span className="font-semibold text-card-foreground">{t.toPay}</span>
          <span className="text-lg font-bold text-primary">{formatPrice(Number(order.total))}</span>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button asChild size="lg">
          <Link href="/catalog">{t.continueShopping}</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/account/orders">{t.myOrders}</Link>
        </Button>
      </div>
    </div>
  )
}
