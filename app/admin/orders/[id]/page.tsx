import { notFound } from 'next/navigation'
import { requirePermission } from '@/lib/session'
import { getOrder } from '@/app/actions/orders'
import { OrderDetail } from '@/components/orders/order-detail'

export const dynamic = 'force-dynamic'

export default async function OrderDetailPage(props: { params: Promise<{ id: string }> }) {
  await requirePermission('orders')
  const { id } = await props.params
  const data = await getOrder(Number.parseInt(id, 10))
  if (!data) notFound()
  return <OrderDetail order={data.order} items={data.items} history={data.history} receipt={data.receipt} />
}
