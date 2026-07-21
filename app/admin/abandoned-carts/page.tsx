import { requirePermission } from '@/lib/session'
import { getAbandonedCarts } from '@/app/actions/abandoned-carts'
import { AbandonedCartsManager } from '@/components/abandoned-carts/abandoned-carts-manager'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Брошенные корзины' }

export default async function AbandonedCartsPage() {
  await requirePermission('abandoned_carts')
  const { carts, stats } = await getAbandonedCarts()

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <AbandonedCartsManager initialCarts={carts} stats={stats} />
    </main>
  )
}
