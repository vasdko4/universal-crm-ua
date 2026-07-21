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
} from '@/app/actions/analytics'
import { StatsDashboard } from '@/components/statistics/stats-dashboard'
import { requirePermission } from '@/lib/session'

export const metadata = { title: 'Статистика · Админ-центр' }
export const dynamic = 'force-dynamic'

export default async function StatisticsPage(props: {
  searchParams: Promise<{ days?: string }>
}) {
  await requirePermission('statistics')
  const sp = await props.searchParams
  const days = Number(sp.days ?? '30') || 30

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
  ] = await Promise.all([
    getStatsSummary(days),
    getTimeseries(days),
    getTopPaths(days, 8),
    getTopReferrers(days, 8),
    getRevenueTimeseries(days),
    getOrderStatusBreakdown(days),
    getDeliveryBreakdown(days),
    getPaymentBreakdown(days),
    getTopProductsPeriod(days, 10),
    getCategorySales(days, 8),
    getCustomerInsights(days),
    getWeekdayActivity(days),
    getAbandonedCartStats(days),
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
      days={days}
    />
  )
}
