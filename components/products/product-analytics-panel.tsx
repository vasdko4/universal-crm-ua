import { getProductAnalytics } from '@/app/actions/analytics'
import { Eye, ShoppingCart, Package, Banknote, TrendingUp, Percent } from 'lucide-react'

function formatUah(n: number) {
  return new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 }).format(n) + ' грн'
}

// Server component: funnel metrics for one product over the last 30 days.
export async function ProductAnalyticsPanel({ productId }: { productId: number }) {
  const a = await getProductAnalytics(productId, 30)

  const cards = [
    { label: 'Просмотры', value: String(a.views), icon: Eye },
    { label: 'В корзину', value: String(a.addToCarts), icon: ShoppingCart },
    { label: 'Продано, шт', value: String(a.unitsSold), icon: Package },
    { label: 'Выручка', value: formatUah(a.revenue), icon: Banknote },
    { label: 'Конверсия в корзину', value: a.cartRate.toFixed(1) + '%', icon: Percent },
    { label: 'Конверсия в заказ', value: a.purchaseRate.toFixed(1) + '%', icon: TrendingUp },
  ]

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Аналитика товара</h2>
        <span className="text-xs text-muted-foreground">за 30 дней</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-md border border-border bg-background p-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <c.icon className="h-4 w-4" aria-hidden="true" />
              <span className="text-xs">{c.label}</span>
            </div>
            <p className="mt-1 text-lg font-semibold text-foreground">{c.value}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
