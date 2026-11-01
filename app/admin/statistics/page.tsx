import {
  getStatsSummary,
  getTimeseries,
  getTopPaths,
  getTopReferrers,
  getRevenueTimeseries,
  getOrderStatusBreakdown,
  getDeliveryBreakdown,
  getPaymentBreakdown,
  getTopProductsPeriod,
  getCategorySales,
  getCustomerInsights,
  getWeekdayActivity,
  getAbandonedCartStats,
  getVisitorSplit,
  getTopBots,
  getGeoStats,
  resetAnalyticsTraffic,
} from '@/app/actions/analytics'
import { StatsDashboard } from '@/components/statistics/stats-dashboard'
import { requirePermission, getAdminUserWithPermission } from '@/lib/session'
import { parsePage } from '@/lib/api/helpers'

export const dynamic = 'force-dynamic'

export default async function StatisticsPage(props: {
  searchParams: Promise<{ days?: string; traffic?: string }>
}) {
  await requirePermission('statistics')
  const sp = await props.searchParams
  const days = parsePage(sp.days, 30)
  // Traffic filter: bots inflate pageviews, so the dashboard can show
  // human traffic only. Default keeps the old "everything" view so
  // existing numbers do not silently change.
  const humansOnly = sp.traffic === 'humans'
  // Reset is destructive and gated by 'settings' server-side too; the
  // button is only rendered for users who actually have that permission.
  const canReset = (await getAdminUserWithPermission('settings')) !== null

  const [
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
    visitorSplit,
    topBots,
    geo,
  ] = await Promise.all([
    getStatsSummary(days, { humansOnly }),
    getTimeseries(days, { humansOnly }),
    getTopPaths(days, 8, { humansOnly }),
    getTopReferrers(days, 8, { humansOnly }),
    getRevenueTimeseries(days),
    getOrderStatusBreakdown(days),
    getDeliveryBreakdown(days),
    getPaymentBreakdown(days),
    getTopProductsPeriod(days, 10),
    getCategorySales(days, 8),
    getCustomerInsights(days),
    getWeekdayActivity(days),
    getAbandonedCartStats(days),
    getVisitorSplit(days),
    getTopBots(days, 8),
    getGeoStats(days, 10),
  ])

  return (
    <StatsDashboard
      summary={summary}
      timeseries={timeseries}
      topPaths={topPaths}
      referrers={referrers}
      revenueSeries={revenueSeries}
      orderStatuses={orderStatuses}
      deliveryBreakdown={deliveryBreakdown}
      paymentBreakdown={paymentBreakdown}
      topProducts={topProducts}
      categorySales={categorySales}
      customers={customers}
      weekdays={weekdays}
      abandoned={abandoned}
      visitorSplit={visitorSplit}
      topBots={topBots}
      geo={geo}
      days={days}
      humansOnly={humansOnly}
      canReset={canReset}
      onReset={resetAnalyticsTraffic}
    />
  )
}
