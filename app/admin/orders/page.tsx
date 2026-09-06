import { requirePermission } from '@/lib/session'
import { listOrders, getOrderStats } from '@/app/actions/orders'
import { OrdersList } from '@/components/orders/orders-list'
import { parsePage } from '@/lib/api/helpers'

export const dynamic = 'force-dynamic'

export default async function OrdersPage(props: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>
}) {
  await requirePermission('orders')
  const sp = await props.searchParams
  const [data, stats] = await Promise.all([
    listOrders({
      search: sp.q,
      status: sp.status,
      page: parsePage(sp.page),
    }),
    getOrderStats(),
  ])

  return (
    <OrdersList
      initialData={data}
      stats={stats}
      initialSearch={sp.q ?? ''}
      initialStatus={sp.status ?? 'all'}
    />
  )
}
