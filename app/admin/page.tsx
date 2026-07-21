import Link from 'next/link'
import {
  ShoppingCart,
  Package,
  TrendingUp,
  Eye,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react'
import { requirePermission } from '@/lib/session'
import { getOrderStats, listOrders } from '@/app/actions/orders'
import { getStatsSummary } from '@/app/actions/analytics'
import { getLowStockProducts } from '@/app/actions/products'
import { StatusBadge } from '@/components/orders/status-badge'

export const dynamic = 'force-dynamic'

function money(n: number) {
  return new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 }).format(n) + ' ₴'
}

export default async function DashboardPage() {
  const user = await requirePermission('dashboard')
  const [stats, analytics, recent, lowStock] = await Promise.all([
    getOrderStats(),
    getStatsSummary(30),
    listOrders({ perPage: 5 }),
    getLowStockProducts(3, 6),
  ])

  const cards = [
    { label: 'Заказов всего', value: stats.total, icon: ShoppingCart, tone: 'text-primary' },
    { label: 'Активные заказы', value: stats.active, icon: Package, tone: 'text-warning' },
    { label: 'Выручка (оплачено)', value: money(stats.revenue), icon: TrendingUp, tone: 'text-success' },
    { label: 'Просмотры (30 дн.)', value: analytics.pageViews, icon: Eye, tone: 'text-info' },
  ]

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Добро пожаловать, {user.name.split(' ')[0]}
        </h1>
        <p className="text-sm text-muted-foreground">Сводка по вашему магазину</p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <c.icon className={`size-5 ${c.tone}`} />
            </div>
            <p className="mt-3 text-2xl font-semibold text-foreground">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="font-semibold text-foreground">Последние заказы</h2>
            <Link
              href="/admin/orders"
              className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Все заказы <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {recent.items.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">Заказов пока нет</p>
            )}
            {recent.items.map((o) => (
              <Link
                key={o.id}
                href={`/admin/orders/${o.id}`}
                className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground">№{o.orderNumber}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {o.customerName ?? 'Без имени'} · {o.itemsCount} шт.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-foreground">{money(Number(o.total))}</span>
                  <StatusBadge status={o.status} />
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-4 font-semibold text-foreground">Воронка (30 дней)</h2>
          <div className="flex flex-col gap-3">
            <FunnelRow label="Просмотры страниц" value={analytics.pageViews} max={analytics.pageViews} />
            <FunnelRow label="Просмотры товаров" value={analytics.productViews} max={analytics.pageViews} />
            <FunnelRow label="Добавления в корзину" value={analytics.addToCarts} max={analytics.pageViews} />
            <FunnelRow label="Заказы" value={analytics.orders} max={analytics.pageViews} />
          </div>
          <div className="mt-4 rounded-lg bg-muted/50 p-3">
            <p className="text-sm text-muted-foreground">Конверсия в заказ</p>
            <p className="text-xl font-semibold text-foreground">{analytics.conversionRate.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="rounded-xl border border-warning/40 bg-card">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="flex items-center gap-2 font-semibold text-foreground">
              <AlertTriangle className="size-4 text-warning" />
              Заканчиваются на складе
            </h2>
            <Link
              href="/admin/products?status=out_of_stock"
              className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              К товарам <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {lowStock.map((p) => (
              <Link
                key={p.id}
                href={`/admin/products/${p.id}/edit`}
                className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{p.name}</p>
                  {p.sku && <p className="text-sm text-muted-foreground">Артикул: {p.sku}</p>}
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${
                    p.quantity === 0
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-warning/10 text-warning'
                  }`}
                >
                  {p.quantity === 0 ? 'Нет в наличии' : `Осталось: ${p.quantity}`}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function FunnelRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{value}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
