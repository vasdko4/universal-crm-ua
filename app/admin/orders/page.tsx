import { requirePermission } from '@/lib/session'
import { listOrders, getOrderStats } from '@/app/actions/orders'
import { OrdersList } from '@/components/orders/orders-list'

export const dynamic = 'force-dynamic'

export default async function OrdersPage(props: {
  searchParams: Promise<{
    q?: string
    status?: string
    payment?: string
    missingTtn?: string
    page?: string
  }>
}) {
  await requirePermission('orders')
  const sp = await props.searchParams
  const [data, stats] = await Promise.all([
    listOrders({
      search: sp.q,
      status: sp.status,
      paymentStatus: sp.payment,
      missingTtn: sp.missingTtn === '1',
      page: sp.page ? Number(sp.page) : 1,
    }),
    getOrderStats(),
  ])

  return (
    <OrdersList
      initialData={data}
      stats={stats}
      initialSearch={sp.q ?? ''}
      initialStatus={sp.status ?? 'all'}
      initialPayment={sp.payment ?? 'all'}
      initialMissingTtn={sp.missingTtn === '1'}
    />
  )
}
