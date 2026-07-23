'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeft,
  MessageCircle,
  Send,
  Mail,
  Phone,
  Truck,
  Package,
  Clock,
  MapPin,
  Megaphone,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatusBadge, PaymentBadge } from '@/components/orders/status-badge'
import {
  updateOrderStatus,
  updateOrderPayment,
  updateOrderDelivery,
  updateOrderNote,
} from '@/app/actions/orders'
import {
  getOrderStatusOptions,
  getPaymentStatusOptions,
  getPaymentMethodLabel,
  getDeliveryMethodLabel,
} from '@/lib/order-status'
import type { Order, OrderItem, OrderHistoryEntry } from '@/lib/db/schema'
import { useAdminI18n } from '@/lib/i18n/admin/context'

function money(v: string | number) {
  const n = typeof v === 'string' ? Number.parseFloat(v) : v
  return new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 }).format(n) + ' ₴'
}

function formatDate(d: Date | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Kyiv',
  })
}

export function OrderDetail({
  order,
  items,
  history,
}: {
  order: Order
  items: OrderItem[]
  history: OrderHistoryEntry[]
}) {
  const router = useRouter()
  const { locale, dict } = useAdminI18n()
  const t = dict.orders
  const [isPending, startTransition] = useTransition()
  const [tracking, setTracking] = useState(order.trackingNumber ?? '')
  const [note, setNote] = useState(order.note ?? '')
  const [sending, setSending] = useState<string | null>(null)

  const orderStatuses = getOrderStatusOptions(locale)
  const paymentStatuses = getPaymentStatusOptions(locale)

  function changeStatus(status: string) {
    startTransition(async () => {
      await updateOrderStatus(order.id, status)
      toast.success(t.toastStatusUpdated)
      router.refresh()
    })
  }

  function changePayment(status: string) {
    startTransition(async () => {
      await updateOrderPayment(order.id, status)
      toast.success(t.toastPaymentUpdated)
      router.refresh()
    })
  }

  function saveTracking() {
    startTransition(async () => {
      await updateOrderDelivery(order.id, { trackingNumber: tracking, deliveryStatus: 'В пути' })
      toast.success(t.toastTrackingSaved)
      router.refresh()
    })
  }

  function saveNote() {
    startTransition(async () => {
      await updateOrderNote(order.id, note)
      toast.success(t.toastNoteSaved)
      router.refresh()
    })
  }

  async function sendMessage(channel: string) {
    setSending(channel)
    try {
      const res = await fetch(`/api/orders/${order.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, kind: 'confirmation' }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? t.toastSendError)
      } else if (data.link) {
        window.open(data.link, '_blank')
        toast.success(t.toastOpeningMessenger)
        router.refresh()
      } else {
        toast.success(t.toastEmailSent)
        router.refresh()
      }
    } catch {
      toast.error(t.toastNetworkError)
    } finally {
      setSending(null)
    }
  }

  const messengers = [
    { key: 'chat', label: dict.messengers.email, icon: Mail },
    { key: 'viber', label: dict.messengers.viber, icon: MessageCircle },
    { key: 'telegram', label: dict.messengers.telegram, icon: Send },
    { key: 'whatsapp', label: dict.messengers.whatsapp, icon: MessageCircle },
    { key: 'sms', label: dict.messengers.sms, icon: Phone },
  ]

  const paidWithLabel = order.paymentMethod ? getPaymentMethodLabel(order.paymentMethod, locale) : null

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 md:px-8">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/admin/orders" aria-label={t.backToOrdersAria}>
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-foreground">{t.orderNumber}{order.orderNumber}</h1>
            <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
          </div>
          <StatusBadge status={order.status} />
        </div>
        <div className="flex items-center gap-2">
          <Select value={order.status} onValueChange={changeStatus} disabled={isPending}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {orderStatuses.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => changeStatus('done')} disabled={isPending || order.status === 'done'}>
            {t.orderCompleted}
          </Button>
        </div>
      </header>

      {order.paymentStatus === 'paid' && (
        <div className="border-b border-border bg-primary/10 px-4 py-2.5 text-sm text-primary md:px-8">
          {t.paidWith}{paidWithLabel ? ` «${paidWithLabel}»` : ''}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 p-4 md:p-8 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-6">
          {/* Items */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 font-semibold text-foreground">{t.itemsInOrder} ({items.length})</h2>
            <div className="flex flex-col divide-y divide-border">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 py-3">
                  <div className="size-14 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image || '/placeholder.svg'} alt={item.name} className="size-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{item.name}</p>
                    {item.variantLabel ? (
                      <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                        {item.variantLabel}
                      </span>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {item.sku ? `${t.sku}: ${item.sku} · ` : ''}
                      {money(item.price)} × {item.quantity} {t.units}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{money(item.total)}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Customer & Payment */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-3 font-semibold text-foreground">{t.customer}</h2>
              <div className="flex flex-col gap-1 text-sm">
                <p className="font-medium text-foreground">{order.customerName ?? '—'}</p>
                {order.customerPhone && (
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="size-3.5" />
                    {order.customerPhone}
                  </p>
                )}
                {order.customerEmail && (
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <Mail className="size-3.5" />
                    {order.customerEmail}
                  </p>
                )}
                {order.utmSource && (
                  <div className="mt-2 flex flex-col gap-0.5 border-t border-border pt-2">
                    <p className="flex items-center gap-1.5 text-muted-foreground">
                      <Megaphone className="size-3.5" />
                      <span className="font-medium text-foreground">{t.trafficSource}:</span>{' '}
                      {order.utmSource}
                      {order.utmMedium ? ` / ${order.utmMedium}` : ''}
                    </p>
                    {order.utmCampaign && (
                      <p className="pl-5 text-xs text-muted-foreground">
                        {t.utmCampaign}: {order.utmCampaign}
                      </p>
                    )}
                    {order.utmTerm && (
                      <p className="pl-5 text-xs text-muted-foreground">
                        {t.utmTerm}: {order.utmTerm}
                      </p>
                    )}
                    {order.utmContent && (
                      <p className="pl-5 text-xs text-muted-foreground">
                        {t.utmContent}: {order.utmContent}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold text-foreground">{t.payment}</h2>
                <PaymentBadge status={order.paymentStatus} />
              </div>
              <div className="flex flex-col gap-2 text-sm">
                <p className="text-muted-foreground">
                  {paidWithLabel ?? t.paymentNotSelected}
                </p>
                <Select value={order.paymentStatus} onValueChange={changePayment} disabled={isPending}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentStatuses.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>
          </div>

          {/* Delivery */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
              <Truck className="size-4" />
              {t.delivery}
            </h2>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.method}</span>
                <span className="text-foreground">
                  {getDeliveryMethodLabel(order.deliveryMethod, locale) ?? '—'}
                </span>
              </div>
              {(order.deliveryCity || order.deliveryBranch) && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{t.address}</span>
                  <span className="text-right text-foreground">
                    {[order.deliveryCity, order.deliveryBranch].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.cost}</span>
                <span className="text-foreground">{money(order.deliveryCost)}</span>
              </div>
              <div className="mt-2 flex items-end gap-2 border-t border-border pt-3">
                <div className="flex-1">
                  <Label htmlFor="tracking" className="text-xs text-muted-foreground">{t.trackingLabel}</Label>
                  <Input id="tracking" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="20450000000000" className="mt-1" />
                </div>
                <Button variant="outline" onClick={saveTracking} disabled={isPending}>
                  {t.saveTracking}
                </Button>
              </div>
              {order.deliveryStatus && (
                <p className="flex items-center gap-1.5 text-warning">
                  <MapPin className="size-3.5" />
                  {order.deliveryStatus}
                </p>
              )}
            </div>
          </section>

          {/* History */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
              <Clock className="size-4" />
              {t.history}
            </h2>
            <div className="flex flex-col gap-3">
              {history.map((h) => (
                <div key={h.id} className="flex gap-3">
                  <div className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(h.createdAt)}
                      {h.actor ? ` · ${h.actor}` : ''}
                    </p>
                    <p className="text-sm text-foreground">{h.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right sidebar */}
        <div className="flex flex-col gap-4">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-semibold text-foreground">{t.total}</h2>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{order.itemsCount} {t.itemsCountLabel}</span>
                <span className="text-foreground">{money(order.itemsTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.delivery}</span>
                <span className="text-foreground">{money(order.deliveryCost)}</span>
              </div>
              {Number(order.discountTotal) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t.discount}{order.promoCode ? ` (${order.promoCode})` : ''}
                  </span>
                  <span className="text-primary">−{money(order.discountTotal)}</span>
                </div>
              )}
              <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-semibold">
                <span className="text-foreground">{t.toPay}</span>
                <span className="text-primary">{money(order.total)}</span>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-semibold text-foreground">{t.actions}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{t.writeToCustomer}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {messengers.map((m) => (
                <Button
                  key={m.key}
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  disabled={sending !== null}
                  onClick={() => sendMessage(m.key === 'chat' ? 'email' : m.key)}
                >
                  <m.icon className="size-4" />
                  {sending === (m.key === 'chat' ? 'email' : m.key) ? '...' : m.label}
                </Button>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-semibold text-foreground">{t.notes}</h2>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 300))}
              placeholder={t.notePlaceholder}
              className="mt-3 min-h-24"
            />
            <div className="mt-2 flex justify-end">
              <Button variant="outline" size="sm" onClick={saveNote} disabled={isPending}>
                {t.save}
              </Button>
            </div>
          </section>

          {Array.isArray(order.tags) && order.tags.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-semibold text-foreground">{t.tags}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {(order.tags as string[]).map((tag) => (
                  <span key={tag} className="rounded-full bg-muted px-2.5 py-1 text-xs text-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
