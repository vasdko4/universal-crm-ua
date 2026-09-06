import { getBestsellers } from '@/app/actions/analytics'
import { BestsellersList } from '@/components/statistics/bestsellers-list'
import { requirePermission } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function BestsellersPage() {
  await requirePermission('bestsellers')
  const rows = await getBestsellers(30)
  return <BestsellersList rows={rows} />
}
