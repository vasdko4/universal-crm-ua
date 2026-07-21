import { getPromotions, getPromotionsCount } from '@/app/actions/promotions'
import { PromotionsList } from '@/components/promotions/promotions-list'
import { requirePermission } from '@/lib/session'

export const metadata = { title: 'Акции · Magazine CRM' }

export default async function PromotionsPage(props: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>
}) {
  await requirePermission('promotions')
  const sp = await props.searchParams
  const search = sp.q ?? ''
  const status = (sp.status as 'all' | 'active' | 'inactive') ?? 'all'
  const page = Number(sp.page ?? '1') || 1

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
