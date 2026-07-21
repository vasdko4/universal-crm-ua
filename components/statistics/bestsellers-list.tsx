'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { Star, Trophy, Package } from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { toggleProductPopular, type BestsellerRow } from '@/app/actions/analytics'

export function BestsellersList({ rows }: { rows: BestsellerRow[] }) {
  const [items, setItems] = useState(rows)
  const [isPending, startTransition] = useTransition()

  const totalUnits = items.reduce((s, r) => s + r.unitsSold, 0)
  const totalRevenue = items.reduce((s, r) => s + r.revenue, 0)

  function togglePopular(productId: number | null, value: boolean) {
    if (!productId) {
      toast.error('Товар не связан с каталогом')
      return
    }
    setItems((prev) =>
      prev.map((r) => (r.productId === productId ? { ...r, isPopular: value } : r)),
    )
    startTransition(async () => {
      const res = await toggleProductPopular(productId, value)
      if (res.success) {
        toast.success(value ? 'Добавлено в топ продаж' : 'Убрано из топа')
      }
    })
  }

  return (
    <div className="flex flex-col">
      <header className="border-b border-border px-6 py-5">
        <h1 className="text-2xl font-semibold text-foreground text-balance">Топ продаж</h1>
        <p className="text-sm text-muted-foreground">
          Рейтинг товаров по продажам. Отмечайте хиты для витрины магазина.
        </p>
      </header>

      <div className="grid gap-6 p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Позиций в рейтинге</p>
              <Trophy className="size-5 text-warning" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">{items.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Продано единиц</p>
              <Package className="size-5 text-primary" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {totalUnits.toLocaleString('ru-RU')}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Выручка</p>
              <Star className="size-5 text-success" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {totalRevenue.toLocaleString('ru-RU')} ₴
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Товар</th>
                <th className="px-4 py-3 text-right font-medium">Продано</th>
                <th className="px-4 py-3 text-right font-medium">Заказов</th>
                <th className="px-4 py-3 text-right font-medium">Выручка</th>
                <th className="px-4 py-3 text-center font-medium">Топ продаж</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r, idx) => (
                <tr key={`${r.productId}-${idx}`} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-semibold text-muted-foreground">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-muted">
                        {r.image ? (
                          <Image
                            src={r.image || "/placeholder.svg"}
                            alt={r.name}
                            fill
                            className="object-cover"
                            sizes="40px"
                            unoptimized
                          />
                        ) : (
                          <Package className="absolute inset-0 m-auto size-4 text-muted-foreground" />
                        )}
                      </div>
                      <span className="line-clamp-2 max-w-md font-medium text-foreground">{r.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-foreground">{r.unitsSold}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{r.ordersCount}</td>
                  <td className="px-4 py-3 text-right font-medium text-foreground">
                    {r.revenue.toLocaleString('ru-RU')} ₴
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center">
                      <Switch
                        checked={r.isPopular}
                        disabled={isPending || !r.productId}
                        onCheckedChange={(v) => togglePopular(r.productId, v)}
                        aria-label="Топ продаж"
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    Пока нет продаж для формирования рейтинга
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
