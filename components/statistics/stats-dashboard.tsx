'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Eye,
  ShoppingCart,
  Package,
  TrendingUp,
  TrendingDown,
  Users,
  Globe,
  Wallet,
  Receipt,
  UserPlus,
  Repeat,
  Truck,
  CreditCard,
  ShoppingBag,
} from 'lucide-react'
import type {
  StatsSummary,
  TimeseriesPoint,
  TopPathRow,
  ReferrerRow,
  RevenuePoint,
  OrderStatusRow,
  MethodBreakdownRow,
  TopProductRow,
  CategorySalesRow,
  CustomerInsights,
  WeekdayRow,
  AbandonedCartStats,
} from '@/app/actions/analytics'

const DAY_OPTIONS = [
  { value: 7, label: '7 дней' },
  { value: 30, label: '30 дней' },
  { value: 90, label: '90 дней' },
]

const STATUS_LABELS: Record<string, string> = {
  new: 'Новый',
  processing: 'В обработке',
  shipped: 'Отправлен',
  done: 'Выполнен',
  cancelled: 'Отменён',
  pending_payment: 'Ждёт оплаты',
}

const STATUS_COLORS: Record<string, string> = {
  new: 'var(--color-info)',
  processing: 'var(--color-warning)',
  shipped: 'var(--color-primary)',
  done: 'var(--color-success)',
  cancelled: 'var(--color-destructive)',
  pending_payment: 'var(--color-muted-foreground)',
}

const METHOD_LABELS: Record<string, string> = {
  nova_poshta: 'Нова Пошта',
  ukrposhta: 'Укрпошта',
  pickup: 'Самовывоз',
  courier: 'Курьер',
  cod: 'Наложенный платёж',
  card: 'Карта онлайн',
  cash: 'Наличные',
  bank_transfer: 'Банковский перевод',
  requisites: 'По реквизитам',
}

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

function money(n: number) {
  return `${Math.round(n).toLocaleString('ru-RU')} ₴`
}

function methodLabel(m: string) {
  return METHOD_LABELS[m] ?? m
}

function TrendBadge({ value }: { value: number | null }) {
  if (value === null) return null
  const up = value >= 0
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        up ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
      }`}
    >
      {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {Math.abs(value).toFixed(0)}%
    </span>
  )
}

const tooltipStyle = {
  background: 'var(--color-popover)',
  border: '1px solid var(--color-border)',
  borderRadius: '8px',
  color: 'var(--color-popover-foreground)',
}

export function StatsDashboard({
  summary,
  timeseries,
  topPaths,
  referrers,
  revenueSeries,
  orderStatuses,
  deliveryBreakdown,
  paymentBreakdown,
  topProducts,
  categorySales,
  customers,
  weekdays,
  abandoned,
  days,
}: {
  summary: StatsSummary
  timeseries: TimeseriesPoint[]
  topPaths: TopPathRow[]
  referrers: ReferrerRow[]
  revenueSeries: RevenuePoint[]
  orderStatuses: OrderStatusRow[]
  deliveryBreakdown: MethodBreakdownRow[]
  paymentBreakdown: MethodBreakdownRow[]
  topProducts: TopProductRow[]
  categorySales: CategorySalesRow[]
  customers: CustomerInsights
  weekdays: WeekdayRow[]
  abandoned: AbandonedCartStats
  days: number
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function setDays(value: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('days', String(value))
    router.push(`/admin/statistics?${params.toString()}`)
  }

  const cards = [
    { label: 'Посетители', value: summary.visitors.toLocaleString('ru-RU'), icon: Users, tone: 'text-primary', trend: summary.trends.visitors },
    { label: 'Просмотры страниц', value: summary.pageViews.toLocaleString('ru-RU'), icon: Eye, tone: 'text-info', trend: summary.trends.pageViews },
    { label: 'Просмотры товаров', value: summary.productViews.toLocaleString('ru-RU'), icon: Package, tone: 'text-primary', trend: null },
    { label: 'В корзину', value: summary.addToCarts.toLocaleString('ru-RU'), icon: ShoppingCart, tone: 'text-warning', trend: null },
    { label: 'Заказы', value: summary.orders.toLocaleString('ru-RU'), icon: TrendingUp, tone: 'text-success', trend: summary.trends.orders },
  ]

  const maxViews = Math.max(...topPaths.map((p) => p.views), 1)
  const maxVisits = Math.max(...referrers.map((r) => r.visits), 1)
  const maxCatRevenue = Math.max(...categorySales.map((c) => c.revenue), 1)
  const maxProductRevenue = Math.max(...topProducts.map((p) => p.revenue), 1)
  const totalStatusCount = Math.max(orderStatuses.reduce((s, r) => s + r.count, 0), 1)

  // Sales funnel steps derived from the summary counters.
  const funnel = [
    { label: 'Посетители', value: summary.visitors, icon: Users },
    { label: 'Просмотры товаров', value: summary.productViews, icon: Package },
    { label: 'Добавили в корзину', value: summary.addToCarts, icon: ShoppingCart },
    { label: 'Оформили заказ', value: summary.orders, icon: Receipt },
  ]
  const maxFunnel = Math.max(...funnel.map((f) => f.value), 1)

  const weekdayData = weekdays.map((w) => ({
    name: WEEKDAY_LABELS[w.weekday - 1],
    orders: w.orders,
    revenue: w.revenue,
  }))

  return (
    <div className="flex flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-5">
        <div>
          <h1 className="text-2xl font-semibold text-foreground text-balance">Статистика</h1>
          <p className="text-sm text-muted-foreground">
            Трафик, продажи, клиенты и эффективность магазина
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          {DAY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                days === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid gap-6 p-6">
        {/* Traffic counters */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{c.label}</p>
                <c.icon className={`size-5 ${c.tone}`} />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <p className="text-2xl font-semibold text-foreground">{c.value}</p>
                <TrendBadge value={c.trend} />
              </div>
            </div>
          ))}
        </div>

        {/* Money counters */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Выручка за период</p>
            <div className="mt-2 flex items-center gap-2">
              <p className="text-2xl font-semibold text-foreground">{money(summary.revenue)}</p>
              <TrendBadge value={summary.trends.revenue} />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Закупка (себестоимость)</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{money(summary.costTotal)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Чистая прибыль</p>
              <Wallet className="size-5 text-success" />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <p className="text-2xl font-semibold text-success">{money(summary.profit)}</p>
              <TrendBadge value={summary.trends.profit} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Маржа: {summary.profitMargin.toFixed(1)}%
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Средний чек</p>
              <Receipt className="size-5 text-primary" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {money(customers.avgOrderValue)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              В среднем {customers.avgItemsPerOrder.toFixed(1)} тов./заказ
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Брошенные корзины</p>
              <ShoppingBag className="size-5 text-warning" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {abandoned.count.toLocaleString('ru-RU')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Потенциально {money(abandoned.total)}
            </p>
          </div>
        </div>

        {/* Revenue & profit chart */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Выручка и прибыль по дням</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueSeries} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="prof" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" tickFormatter={formatDate} stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(l) => formatDate(String(l))}
                  formatter={(value, name) =>
                    name === 'Заказы' ? [Number(value ?? 0), name] : [money(Number(value ?? 0)), name]
                  }
                />
                <Area type="monotone" dataKey="revenue" name="Выручка" stroke="var(--color-primary)" fill="url(#rev)" strokeWidth={2} />
                <Area type="monotone" dataKey="profit" name="Прибыль" stroke="var(--color-success)" fill="url(#prof)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Funnel + order statuses */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Воронка продаж</h2>
            <div className="flex flex-col gap-4">
              {funnel.map((step, i) => {
                const prevValue = i > 0 ? funnel[i - 1].value : null
                const convFromPrev =
                  prevValue && prevValue > 0 ? (step.value / prevValue) * 100 : null
                return (
                  <div key={step.label} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-foreground">
                        <step.icon className="size-4 text-muted-foreground" />
                        {step.label}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {step.value.toLocaleString('ru-RU')}
                        </span>
                        {convFromPrev !== null && (
                          <span className="text-xs text-muted-foreground">
                            {convFromPrev.toFixed(1)}%
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${(step.value / maxFunnel) * 100}%` }}
                      />
                    </div>
                  </div>
                )
              })}
              <p className="mt-1 text-xs text-muted-foreground">
                Общая конверсия посетителя в заказ: {summary.conversionRate.toFixed(2)}% · Конверсия
                корзины: {summary.cartConversion.toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Статусы заказов</h2>
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="h-48 w-48 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={orderStatuses}
                      dataKey="count"
                      nameKey="status"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={2}
                    >
                      {orderStatuses.map((s) => (
                        <Cell
                          key={s.status}
                          fill={STATUS_COLORS[s.status] ?? 'var(--color-muted-foreground)'}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value, _n, item) => {
                        const v = Number(value ?? 0)
                        const status = String(
                          (item?.payload as { status?: string } | undefined)?.status ?? '',
                        )
                        return [
                          `${v} (${((v / totalStatusCount) * 100).toFixed(0)}%)`,
                          STATUS_LABELS[status] ?? status,
                        ]
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex w-full flex-col gap-2">
                {orderStatuses.map((s) => (
                  <div key={s.status} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 text-foreground">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ background: STATUS_COLORS[s.status] ?? 'var(--color-muted-foreground)' }}
                      />
                      {STATUS_LABELS[s.status] ?? s.status}
                    </span>
                    <span className="text-muted-foreground">
                      {s.count} · {money(s.total)}
                    </span>
                  </div>
                ))}
                {orderStatuses.length === 0 && (
                  <p className="text-sm text-muted-foreground">Нет заказов за период</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Top products + categories */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Топ товаров за период</h2>
            <div className="flex flex-col gap-3">
              {topProducts.map((p, i) => (
                <div key={`${p.productId}-${i}`} className="flex items-center gap-3">
                  <span className="w-5 shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <div className="relative size-10 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                    {p.image ? (
                      <Image src={p.image || "/placeholder.svg"} alt="" fill sizes="40px" className="object-contain p-0.5" />
                    ) : (
                      <Package className="absolute inset-0 m-auto size-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(p.revenue / maxProductRevenue) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-foreground">{money(p.revenue)}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.unitsSold} шт · прибыль {money(p.profit)}
                    </p>
                  </div>
                </div>
              ))}
              {topProducts.length === 0 && (
                <p className="text-sm text-muted-foreground">Нет продаж за выбранный период</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Продажи по категориям</h2>
            <div className="flex flex-col gap-3">
              {categorySales.map((c) => (
                <div key={c.name} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 truncate text-sm text-foreground">{c.name}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-info"
                      style={{ width: `${(c.revenue / maxCatRevenue) * 100}%` }}
                    />
                  </div>
                  <span className="w-28 shrink-0 text-right text-sm text-muted-foreground">
                    {money(c.revenue)}
                  </span>
                </div>
              ))}
              {categorySales.length === 0 && (
                <p className="text-sm text-muted-foreground">Нет данных за выбранный период</p>
              )}
            </div>

            <h2 className="mb-4 mt-8 text-lg font-semibold text-foreground">Заказы по дням недели</h2>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekdayData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} allowDecimals={false} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value, name) =>
                      name === 'Выручка' ? [money(Number(value ?? 0)), name] : [Number(value ?? 0), name]
                    }
                  />
                  <Bar dataKey="orders" name="Заказы" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Customers + delivery/payment */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Клиенты</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="size-4" />
                  <span className="text-xs">Уникальных</span>
                </div>
                <p className="mt-1 text-xl font-semibold text-foreground">
                  {customers.uniqueCustomers.toLocaleString('ru-RU')}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <UserPlus className="size-4" />
                  <span className="text-xs">Новых</span>
                </div>
                <p className="mt-1 text-xl font-semibold text-success">
                  {customers.newCustomers.toLocaleString('ru-RU')}
                </p>
              </div>
              <div className="col-span-2 rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Repeat className="size-4" />
                  <span className="text-xs">Повторные покупатели</span>
                </div>
                <p className="mt-1 text-xl font-semibold text-primary">
                  {customers.returningCustomers.toLocaleString('ru-RU')}
                </p>
              </div>
            </div>

            <h3 className="mb-2 mt-5 text-sm font-semibold text-foreground">Топ покупателей</h3>
            <div className="flex flex-col gap-2">
              {customers.topCustomers.map((c, i) => (
                <div key={`${c.phone}-${i}`} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate text-foreground">{c.name}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {c.orders} зак. · {money(c.total)}
                  </span>
                </div>
              ))}
              {customers.topCustomers.length === 0 && (
                <p className="text-sm text-muted-foreground">Нет данных</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
              <Truck className="size-5 text-muted-foreground" />
              Способы доставки
            </h2>
            <div className="flex flex-col gap-3">
              {deliveryBreakdown.map((d) => {
                const max = Math.max(...deliveryBreakdown.map((x) => x.count), 1)
                return (
                  <div key={d.method} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{methodLabel(d.method)}</span>
                      <span className="text-muted-foreground">
                        {d.count} · {money(d.total)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(d.count / max) * 100}%` }}
                      />
                    </div>
                  </div>
                )
              })}
              {deliveryBreakdown.length === 0 && (
                <p className="text-sm text-muted-foreground">Нет данных</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
              <CreditCard className="size-5 text-muted-foreground" />
              Способы оплаты
            </h2>
            <div className="flex flex-col gap-3">
              {paymentBreakdown.map((p) => {
                const max = Math.max(...paymentBreakdown.map((x) => x.count), 1)
                return (
                  <div key={p.method} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{methodLabel(p.method)}</span>
                      <span className="text-muted-foreground">
                        {p.count} · {money(p.total)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-info"
                        style={{ width: `${(p.count / max) * 100}%` }}
                      />
                    </div>
                  </div>
                )
              })}
              {paymentBreakdown.length === 0 && (
                <p className="text-sm text-muted-foreground">Нет данных</p>
              )}
            </div>
          </div>
        </div>

        {/* Traffic chart */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Динамика просмотров и заказов</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeseries} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="views" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="orders" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  stroke="var(--color-muted-foreground)"
                  fontSize={12}
                />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => formatDate(String(l))} />
                <Area
                  type="monotone"
                  dataKey="pageViews"
                  name="Просмотры"
                  stroke="var(--color-primary)"
                  fill="url(#views)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="visitors"
                  name="Посетители"
                  stroke="var(--color-info)"
                  fill="transparent"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                />
                <Area
                  type="monotone"
                  dataKey="orders"
                  name="Заказы"
                  stroke="var(--color-success)"
                  fill="url(#orders)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pages + referrers */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Популярные страницы</h2>
            <div className="flex flex-col gap-3">
              {topPaths.map((p) => (
                <div key={p.path} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 truncate font-mono text-sm text-foreground">{p.path}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(p.views / maxViews) * 100}%` }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right text-sm text-muted-foreground">
                    {p.views.toLocaleString('ru-RU')}
                  </span>
                </div>
              ))}
              {topPaths.length === 0 && (
                <p className="text-sm text-muted-foreground">Нет данных за выбранный период</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
              <Globe className="size-5 text-muted-foreground" />
              Источники трафика
            </h2>
            <div className="flex flex-col gap-3">
              {referrers.map((r) => (
                <div key={r.source} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 truncate text-sm text-foreground">{r.source}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-info"
                      style={{ width: `${(r.visits / maxVisits) * 100}%` }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right text-sm text-muted-foreground">
                    {r.visits.toLocaleString('ru-RU')}
                  </span>
                </div>
              ))}
              {referrers.length === 0 && (
                <p className="text-sm text-muted-foreground">Нет данных за выбранный период</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
