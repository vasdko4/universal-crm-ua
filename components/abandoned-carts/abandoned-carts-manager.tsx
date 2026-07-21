'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { AbandonedCart } from '@/lib/db/schema'
import {
  sendCartReminder,
  dismissAbandonedCarts,
  type AbandonedCartsStats,
  type AbandonedCartItem,
} from '@/app/actions/abandoned-carts'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ShoppingBasket, Mail, EyeOff, Phone, Loader2, CheckCircle2, RefreshCw } from 'lucide-react'

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  open: { label: 'Не завершена', cls: 'bg-destructive/10 text-destructive' },
  reminded: { label: 'Напомнили', cls: 'bg-primary/10 text-primary' },
  recovered: { label: 'Купил', cls: 'bg-success/10 text-success' },
}

function money(v: string | number) {
  return `${Number(v).toLocaleString('uk-UA')} ₴`
}

function timeAgo(d: Date | string | null): string {
  if (!d) return ''
  const ms = Date.now() - new Date(d).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 60) return `${min} мин назад`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} ч назад`
  return `${Math.floor(h / 24)} дн назад`
}

export function AbandonedCartsManager({
  initialCarts,
  stats,
}: {
  initialCarts: AbandonedCart[]
  stats: AbandonedCartsStats
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<number | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [filter, setFilter] = useState<'active' | 'recovered' | 'all'>('active')

  const carts = initialCarts.filter((c) => {
    if (filter === 'active') return c.status === 'open' || c.status === 'reminded'
    if (filter === 'recovered') return c.status === 'recovered'
    return true
  })

  const remind = (id: number) => {
    setBusyId(id)
    setNotice(null)
    startTransition(async () => {
      const res = await sendCartReminder(id)
      setBusyId(null)
      if (!res.success) setNotice(res.error ?? 'Ошибка')
      else if (res.error) setNotice(res.error)
      else setNotice('Напоминание отправлено')
      router.refresh()
    })
  }

  const dismiss = (id: number) => {
    setBusyId(id)
    startTransition(async () => {
      await dismissAbandonedCarts([id])
      setBusyId(null)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Брошенные корзины</h1>
          <p className="text-sm text-muted-foreground">
            Посетители, которые начали оформление, но не завершили заказ
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.refresh()} disabled={pending}>
          <RefreshCw className="size-4" />
          Обновить
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Открытые" value={String(stats.open)} />
        <StatCard label="С напоминанием" value={String(stats.reminded)} />
        <StatCard label="Вернулись и купили" value={String(stats.recovered)} />
        <StatCard label="Потенциальная выручка" value={money(stats.potentialRevenue)} />
      </div>

      {notice && (
        <p className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground">{notice}</p>
      )}

      <div className="flex gap-2">
        {(
          [
            ['active', 'Активные'],
            ['recovered', 'Восстановленные'],
            ['all', 'Все'],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            variant={filter === key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {carts.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <ShoppingBasket className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {filter === 'active'
              ? 'Активных брошенных корзин нет. Корзина попадает сюда, когда посетитель ввёл контакты на оформлении, но не завершил заказ в течение 30 минут.'
              : 'Список пуст'}
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {carts.map((cart) => {
            const items = (cart.items as AbandonedCartItem[]) ?? []
            const st = STATUS_LABEL[cart.status] ?? STATUS_LABEL.open
            return (
              <Card key={cart.id} className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">
                        {cart.customerName || 'Без имени'}
                      </span>
                      <Badge variant="secondary" className={st.cls}>
                        {cart.status === 'recovered' && <CheckCircle2 className="size-3" />}
                        {st.label}
                      </Badge>
                      {cart.recoveredOrderNumber && (
                        <span className="text-xs text-muted-foreground">
                          заказ №{cart.recoveredOrderNumber}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {cart.customerPhone && (
                        <span className="flex items-center gap-1">
                          <Phone className="size-3.5" />
                          {cart.customerPhone}
                        </span>
                      )}
                      {cart.customerEmail && (
                        <span className="flex items-center gap-1">
                          <Mail className="size-3.5" />
                          {cart.customerEmail}
                        </span>
                      )}
                      <span>{timeAgo(cart.updatedAt)}</span>
                      {cart.remindedAt && <span>напоминание: {timeAgo(cart.remindedAt)}</span>}
                    </div>
                  </div>
                  <p className="text-lg font-semibold text-foreground">{money(cart.itemsTotal)}</p>
                </div>

                <ul className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3 text-sm">
                  {items.map((i, idx) => (
                    <li key={idx} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-foreground">{i.name}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {i.quantity} шт. × {money(i.price)}
                      </span>
                    </li>
                  ))}
                </ul>

                {cart.status !== 'recovered' && (
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => dismiss(cart.id)}
                      disabled={pending && busyId === cart.id}
                    >
                      <EyeOff className="size-4" />
                      Скрыть
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => remind(cart.id)}
                      disabled={(pending && busyId === cart.id) || !cart.customerEmail}
                      title={!cart.customerEmail ? 'Нет email — свяжитесь по телефону' : undefined}
                    >
                      {pending && busyId === cart.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Mail className="size-4" />
                      )}
                      Напомнить письмом
                    </Button>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold text-foreground">{value}</p>
    </Card>
  )
}
