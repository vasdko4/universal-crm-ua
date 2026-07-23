import { getProductAnalytics } from '@/app/actions/analytics'
import { Eye, ShoppingCart, Package, Banknote, TrendingUp, Percent } from 'lucide-react'
import { getAdminDictionary } from '@/lib/i18n/admin/dictionaries'
import type { Locale } from '@/lib/i18n/config'

function formatUah(n: number) {
  return new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 }).format(n) + ' грн'
}

// Server component: funnel metrics for one product over the last 30 days.
export async function ProductAnalyticsPanel({
  productId,
  locale,
}: {
  productId: number
  locale: Locale
}) {
  const a = await getProductAnalytics(productId, 30)
  const t = getAdminDictionary(locale).productAnalytics

  const cards = [
    { label: t.views, value: String(a.views), icon: Eye },
    { label: t.addToCart, value: String(a.addToCarts), icon: ShoppingCart },
    { label: t.unitsSold, value: String(a.unitsSold), icon: Package },
    { label: t.revenue, value: formatUah(a.revenue), icon: Banknote },
    { label: t.cartRate, value: a.cartRate.toFixed(1) + '%', icon: Percent },
    { label: t.purchaseRate, value: a.purchaseRate.toFixed(1) + '%', icon: TrendingUp },
  ]

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">{t.title}</h2>
        <span className="text-xs text-muted-foreground">{t.period}</span>
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
