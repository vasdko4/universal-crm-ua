import { getGateways, getPayments } from '@/app/actions/payments'
import { getPaymentMethods } from '@/app/actions/settings'
import { PaymentsManager } from '@/components/payments/payments-manager'

export const dynamic = 'force-dynamic'

export default async function PaymentsPage() {
  const [gateways, payments, methods] = await Promise.all([
    getGateways(),
    getPayments(),
    getPaymentMethods(),
  ])
  return <PaymentsManager gateways={gateways} payments={payments} methods={methods} />
}
