import { getGateways, getPayments } from '@/app/actions/payments'
import { getPaymentMethods } from '@/app/actions/settings'
import { PaymentsManager } from '@/components/payments/payments-manager'
import { requirePermission } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function PaymentsPage() {
  await requirePermission('payments')
  const [gateways, payments, methods] = await Promise.all([
    getGateways(),
    getPayments(),
    getPaymentMethods(),
  ])
  return <PaymentsManager gateways={gateways} payments={payments} methods={methods} />
}
