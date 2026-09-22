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
import { getOrderStats, getOpsQueue, listOrders } from '@/app/actions/orders'
import { getStatsSummary } from '@/app/actions/analytics'
import { getLowStockProducts } from '@/app/actions/products'
import { StatusBadge } from '@/components/orders/status-badge'
import { getAdminDictionary } from '@/lib/i18n/admin/dictionaries'
import { pickLocalized } from '@/lib/i18n/config'
import { getStaffTwoFactorState } from '@/app/actions/staff-2fa'
import { StaffTwoFactorCard } from '@/components/staff-2fa-card'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

function money(n: number, locale: string) {
  const tag = locale === 'ru' ? 'ru-RU' : 'uk-UA'
  return new Intl.NumberFormat(tag, { maximumFractionDigits: 0 }).format(n) + ' ₴'
}

function dash(failed: boolean, value: string | number) {
  return failed ? '—' : value
}

export default async function DashboardPage() {
  const user = await requirePermission('dashboard')
  const t = getAdminDictionary(user.locale).dashboard
  const emptyStats = { total: 0, new: 0, active: 0, revenue: 0 }
  const emptyAnalytics = {
    pageViews: 0,
    productViews: 0,
    addToCarts: 0,
    orders: 0,
    conversionRate: 0,
  }
  const emptyQueue = { newOrders: 0, unpaid: 0, missingTtn: 0, overdueShipped: 0, pendingReviews: 0 }

  const [statsRes, analyticsRes, recentRes, lowStockRes, queueRes, twoFa] = await Promise.all([
    getOrderStats()
      .then((data) => ({ data, failed: false as const }))
      .catch((e) => {
        console.error('[admin] getOrderStats failed:', e)
        return { data: emptyStats, failed: true as const }
      }),
    getStatsSummary(30)
      .then((data) => ({ data, failed: false as const }))
      .catch((e) => {
        console.error('[admin] getStatsSummary failed:', e)
        return { data: emptyAnalytics as Awaited<ReturnType<typeof getStatsSummary>>, failed: true as const }
      }),
    listOrders({ perPage: 5 })
      .then((data) => ({ data, failed: false as const }))
      .catch((e) => {
        console.error('[admin] listOrders failed:', e)
        return { data: { items: [], total: 0, page: 1, perPage: 5 }, failed: true as const }
      }),
    getLowStockProducts(3, 6)
      .then((data) => ({ data, failed: false as const }))
      .catch((e) => {
        console.error('[admin] getLowStockProducts failed:', e)
        return { data: [] as Awaited<ReturnType<typeof getLowStockProducts>>, failed: true as const }
      }),
    getOpsQueue()
      .then((data) => ({ data, failed: false as const }))
      .catch((e) => {
        console.error('[admin] getOpsQueue failed:', e)
        return { data: emptyQueue, failed: true as const }
      }),
    getStaffTwoFactorState().catch(() => ({ enabled: false, pending: false })),
  ])
  const stats = statsRes.data
  const analytics = analyticsRes.data
  const recent = recentRes.data
  const lowStock = lowStockRes.data
  const queue = queueRes.data
  const statsFailed = statsRes.failed
  const analyticsFailed = analyticsRes.failed
  const recentFailed = recentRes.failed
  const lowStockFailed = lowStockRes.failed
  const queueFailed = queueRes.failed

  const loadFailed = statsFailed || analyticsFailed || recentFailed || queueFailed || lowStockFailed

  const cards = [
    { label: t.statOrdersTotal, value: dash(statsFailed, stats.total), icon: ShoppingCart, tone: 'text-primary' },
    { label: t.statOrdersActive, value: dash(statsFailed, stats.active), icon: Package, tone: 'text-warning' },
    {
      label: t.statRevenue,
      value: dash(statsFailed, money(stats.revenue, user.locale)),
      icon: TrendingUp,
      tone: 'text-success',
    },
    { label: t.statViews, value: dash(analyticsFailed, analytics.pageViews), icon: Eye, tone: 'text-info' },
  ]

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t.welcome.replace('{name}', user.name.split(' ')[0])}
        </h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </header>

      {loadFailed && (
        <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-destructive">{t.loadError}</p>
          <Button asChild size="sm" variant="outline">
            <a href="/admin">{t.tryAgain}</a>
          </Button>
        </div>
      )}

      <StaffTwoFactorCard enabled={twoFa.enabled} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { href: '/admin/orders?status=new', label: t.queueNew, value: dash(queueFailed, queue.newOrders) },
          { href: '/admin/orders?payment=unpaid', label: t.queueUnpaid, value: dash(queueFailed, queue.unpaid) },
          { href: '/admin/orders?missingTtn=1', label: t.queueMissingTtn, value: dash(queueFailed, queue.missingTtn) },
          { href: '/admin/orders?status=shipped', label: t.queueOverdue, value: dash(queueFailed, queue.overdueShipped) },
          { href: '/admin/reviews?status=pending', label: t.queueReviews, value: dash(queueFailed, queue.pendingReviews) },
        ].map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50"
          >
            <p className="text-sm text-muted-foreground">{q.label}</p>
            <p
              className={`mt-2 text-2xl font-semibold ${
                !queueFailed && typeof q.value === 'number' && q.value > 0 ? 'text-warning' : 'text-foreground'
              }`}
            >
              {q.value}
            </p>
          </Link>
        ))}
      </div>

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
            <h2 className="font-semibold text-foreground">{t.recentOrdersTitle}</h2>
            <Link
              href="/admin/orders"
              className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              {t.allOrders} <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {recentFailed && <p className="p-6 text-center text-sm text-destructive">{t.loadError}</p>}
            {!recentFailed && recent.items.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">{t.noOrders}</p>
            )}
            {!recentFailed &&
              recent.items.map((o) => (
                <Link
                  key={o.id}
                  href={`/admin/orders/${o.id}`}
                  className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">№{o.orderNumber}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {o.customerName ?? t.noName} · {o.itemsCount} {t.unitsSuffix}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-foreground">{money(Number(o.total), user.locale)}</span>
                    <StatusBadge status={o.status} />
                  </div>
                </Link>
              ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-4 font-semibold text-foreground">{t.funnelTitle}</h2>
          {analyticsFailed ? (
            <p className="text-sm text-destructive">{t.loadError}</p>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                <FunnelRow label={t.funnelPageViews} value={analytics.pageViews} max={analytics.pageViews} />
                <FunnelRow label={t.funnelProductViews} value={analytics.productViews} max={analytics.pageViews} />
                <FunnelRow label={t.funnelAddToCart} value={analytics.addToCarts} max={analytics.pageViews} />
                <FunnelRow label={t.funnelOrders} value={analytics.orders} max={analytics.pageViews} />
              </div>
              <div className="mt-4 rounded-lg bg-muted/50 p-3">
                <p className="text-sm text-muted-foreground">{t.conversionRate}</p>
                <p className="text-xl font-semibold text-foreground">{analytics.conversionRate.toFixed(1)}%</p>
              </div>
            </>
          )}
        </div>
      </div>

      {lowStockFailed && (
        <div className="rounded-xl border border-destructive/30 bg-card p-4">
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-foreground">
            <AlertTriangle className="size-4 text-warning" />
            {t.lowStockTitle}
          </h2>
          <p className="text-sm text-destructive">{t.loadError}</p>
        </div>
      )}

      {!lowStockFailed && lowStock.length > 0 && (
        <div className="rounded-xl border border-warning/40 bg-card">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="flex items-center gap-2 font-semibold text-foreground">
              <AlertTriangle className="size-4 text-warning" />
              {t.lowStockTitle}
            </h2>
            <Link
              href="/admin/products?status=out_of_stock"
              className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              {t.toProducts} <ArrowRight className="size-4" />
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
                  <p className="truncate font-medium text-foreground">
                    {pickLocalized(user.locale, p.nameUk, p.nameRu)}
                  </p>
                  {p.sku && (
                    <p className="text-sm text-muted-foreground">
                      {t.skuLabel}: {p.sku}
                    </p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${
                    p.quantity === 0
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-warning/10 text-warning'
                  }`}
                >
                  {p.quantity === 0 ? t.outOfStock : `${t.remainingPrefix}: ${p.quantity}`}
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
