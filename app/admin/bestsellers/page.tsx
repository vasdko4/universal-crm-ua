import { getBestsellers } from '@/app/actions/analytics'
import { BestsellersList } from '@/components/statistics/bestsellers-list'

export const metadata = { title: 'Топ продаж · Админ-центр' }
export const dynamic = 'force-dynamic'

export default async function BestsellersPage() {
  const rows = await getBestsellers(30)
  return <BestsellersList rows={rows} />
}
