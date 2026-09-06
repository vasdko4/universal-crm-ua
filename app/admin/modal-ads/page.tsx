import { requirePermission } from '@/lib/session'
import { getModalAds } from '@/app/actions/modal-ads'
import { ModalAdsManager } from '@/components/modal-ads/modal-ads-manager'
import { parsePage } from '@/lib/api/helpers'

export default async function ModalAdsPage(props: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>
}) {
  await requirePermission('modal_ads')
  const sp = await props.searchParams
  const search = sp.q ?? ''
  const status = (sp.status as 'all' | 'active' | 'inactive') ?? 'all'
  const page = parsePage(sp.page)

  const data = await getModalAds({ search, status, page })

  return <ModalAdsManager data={data} search={search} status={status} />
}
