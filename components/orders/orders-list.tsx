'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  Search,
  Plus,
  ShoppingCart,
  Package,
  TrendingUp,
  Truck,
  Phone,
  MapPin,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatusBadge, PaymentBadge } from '@/components/orders/status-badge'
import { updateOrderStatus } from '@/app/actions/orders'
import { ORDER_STATUSES, type OrderListParams } from '@/lib/order-status'
import type { Order } from '@/lib/db/schema'

type Stats = { total: number; new: number; active: number; revenue: number }

function money(v: string | number) {
  const n = typeof v === 'string' ? Number.parseFloat(v) : v
  return new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 }).format(n) + ' ₴'
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

export function OrdersList({
  initialData,
  stats,
  initialSearch,
  initialStatus,
}: {
  initialData: { items: Order[]; total: number; page: number; perPage: number }
  stats: Stats
  initialSearch: string
  initialStatus: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(initialSearch)
  const [status, setStatus] = useState(initialStatus)

  function applyFilters(next: { q?: string; status?: string; page?: number }) {
    const params = new URLSearchParams(searchParams.toString())
    const q = next.q ?? search
    const s = next.status ?? status
    if (q) params.set('q', q)
    else params.delete('q')
    if (s && s !== 'all') params.set('status', s)
    else params.delete('status')
    params.set('page', String(next.page ?? 1))
    startTransition(() => router.push(`/admin/orders?${params.toString()}`))
  }

  function handleStatusChange(orderId: number, newStatus: string) {
    startTransition(async () => {
      const res = await updateOrderStatus(orderId, newStatus)
      if (res.success) {
        toast.success('Статус обновлён')
        router.refresh()
      } else {
        toast.error(res.error ?? 'Ошибка')
      }
    })
  }

  const totalPages = Math.ceil(initialData.total / initialData.perPage)

  const statCards = [
    { label: 'Всего заказов', value: stats.total, icon: ShoppingCart },
    { label: 'Новые', value: stats.new, icon: Package },
    { label: 'Активные', value: stats.active, icon: Truck },
    { label: 'Выручка', value: money(stats.revenue), icon: TrendingUp },
  ]

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Заказы</h1>
          <p className="text-sm text-muted-foreground">Список заказов: {initialData.total}</p>
        </div>
        <Button asChild>
          <Link href="/admin/orders/new">
            <Plus className="size-4" />
            Создать заказ
          </Link>
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <c.icon className="size-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-xl font-semibold text-foreground">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            applyFilters({ page: 1 })
          }}
          className="relative flex-1"
        >
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по номеру, имени, телефону, email, накладной"
            className="pl-9"
          />
        </form>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v)
            applyFilters({ status: v, page: 1 })
          }}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            {ORDER_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {initialData.items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-12 text-center">
            <ShoppingCart className="size-10 text-muted-foreground" />
            <p className="font-medium text-foreground">Заказов не найдено</p>
            <p className="text-sm text-muted-foreground">Измените фильтры или создайте новый заказ</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {initialData.items.map((o) => (
              <div key={o.id} className="grid grid-cols-1 gap-4 p-4 md:grid-cols-[1.5fr_1fr_1.5fr_auto] md:items-center">
                <div className="min-w-0">
                  <Link href={`/admin/orders/${o.id}`} className="font-medium text-primary hover:underline">
                    №{o.orderNumber}
                  </Link>
                  <p className="text-xs text-muted-foreground">{formatDate(o.createdAt)}</p>
                  <p className="mt-1 text-sm text-foreground">
                    {money(o.total)} · {o.itemsCount} шт.
                  </p>
                </div>

                <div className="min-w-0 text-sm">
                  <p className="truncate font-medium text-foreground">{o.customerName ?? '—'}</p>
                  {o.customerPhone && (
                    <p className="flex items-center gap-1 text-muted-foreground">
                      <Phone className="size-3" />
                      {o.customerPhone}
                    </p>
                  )}
                </div>

                <div className="min-w-0 text-sm">
                  <p className="flex items-center gap-1 text-foreground">
                    <Truck className="size-3.5 text-muted-foreground" />
                    {o.deliveryMethod === 'nova_poshta'
                      ? 'Нова Пошта'
                      : o.deliveryMethod === 'ukrposhta'
                        ? 'Укрпошта'
                        : o.deliveryMethod ?? 'Не выбрано'}
                  </p>
                  {o.deliveryCity && (
                    <p className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="size-3" />
                      <span className="truncate">{o.deliveryCity}</span>
                    </p>
                  )}
                  {o.trackingNumber && (
                    <p className="text-xs text-warning">ЕН {o.trackingNumber}</p>
                  )}
                  <div className="mt-1">
                    <PaymentBadge status={o.paymentStatus} />
                  </div>
                </div>

                <div className="w-full md:w-44">
                  <Select value={o.status} onValueChange={(v) => handleStatusChange(o.id, v)} disabled={isPending}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORDER_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={initialData.page <= 1 || isPending}
            onClick={() => applyFilters({ page: initialData.page - 1 })}
          >
            Назад
          </Button>
          <span className="text-sm text-muted-foreground">
            {initialData.page} из {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={initialData.page >= totalPages || isPending}
            onClick={() => applyFilters({ page: initialData.page + 1 })}
          >
            Вперёд
          </Button>
        </div>
      )}
    </div>
  )
}
