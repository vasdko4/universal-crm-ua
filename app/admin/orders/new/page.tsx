import { requireWritePermission } from '@/lib/session'
import { OrderBuilder } from '@/components/orders/order-builder'

export const dynamic = 'force-dynamic'

export default async function NewOrderPage() {
  await requireWritePermission('orders')
  return <OrderBuilder />
}
