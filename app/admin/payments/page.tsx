import { getGateways, getPayments } from '@/app/actions/payments'
import { getPaymentMethods } from '@/app/actions/settings'
import { PaymentsManager } from '@/components/payments/payments-manager'
import { requirePermission } from '@/lib/session'
import { parsePage } from '@/lib/api/helpers'

export const dynamic = 'force-dynamic'

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  await requirePermission('payments')
  const sp = await searchParams
  const [gateways, paymentList, methods] = await Promise.all([
    getGateways(),
    getPayments({ page: parsePage(sp.page) }),
    getPaymentMethods(),
  ])
  return <PaymentsManager gateways={gateways} payments={paymentList} methods={methods} />
}
