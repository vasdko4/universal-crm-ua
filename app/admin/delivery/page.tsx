import { getDeliveryMethods } from '@/app/actions/settings'
import { DeliveryManager } from '@/components/delivery/delivery-manager'

export const dynamic = 'force-dynamic'

export default async function DeliveryPage() {
  const methods = await getDeliveryMethods()
  return <DeliveryManager methods={methods} />
}
