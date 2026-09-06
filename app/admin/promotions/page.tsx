import { getPromotions, getPromotionsCount } from '@/app/actions/promotions'
import { PromotionsList } from '@/components/promotions/promotions-list'
import { requirePermission } from '@/lib/session'
import { parsePage } from '@/lib/api/helpers'

export default async function PromotionsPage(props: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>
}) {
  await requirePermission('promotions')
  const sp = await props.searchParams
  const search = sp.q ?? ''
  const status = (sp.status as 'all' | 'active' | 'inactive') ?? 'all'
  const page = parsePage(sp.page)

  const [data, totalCount] = await Promise.all([
    getPromotions({ search, status, page }),
    getPromotionsCount(),
  ])

  return (
    <PromotionsList
      data={data}
      totalCount={totalCount}
      search={search}
      status={status}
    />
  )
}
