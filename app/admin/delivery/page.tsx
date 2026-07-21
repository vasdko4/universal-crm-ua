import { getDeliveryMethods } from '@/app/actions/settings'
import { DeliveryManager } from '@/components/delivery/delivery-manager'
import { requirePermission } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function DeliveryPage() {
  await requirePermission('delivery')
  const methods = await getDeliveryMethods()
  return (
    <div className="p-4 md:p-8">
      <DeliveryManager methods={methods} />
    </div>
  )
}
