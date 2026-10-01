import { getCampaignReport, getCheckoutFunnel } from '@/app/actions/analytics'
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard'
import { requirePermission } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage(props: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  await requirePermission('statistics')
  const sp = await props.searchParams
  const [report, funnel] = await Promise.all([
    getCampaignReport(sp.from, sp.to),
    getCheckoutFunnel(sp.from, sp.to),
  ])
  // The actions normalize the date filter — the UI reflects the effective
  // range so a typo in the URL never shows mismatched data.
  return <AnalyticsDashboard report={report} funnel={funnel} />
}
