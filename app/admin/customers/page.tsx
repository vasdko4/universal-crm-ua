import { getCustomers } from '@/app/actions/customers'
import { CustomersManager } from '@/components/customers/customers-manager'
import { requirePermission } from '@/lib/session'
import { parsePage } from '@/lib/api/helpers'

export const dynamic = 'force-dynamic'

export default async function CustomersPage(props: {
  searchParams: Promise<{ q?: string; page?: string; score?: string }>
}) {
  await requirePermission('customers')
  const sp = await props.searchParams
  const data = await getCustomers({
    search: sp.q,
    page: parsePage(sp.page),
    minScore: parsePage(sp.score, 0),
  })

  return <CustomersManager initialData={data} initialSearch={sp.q ?? ''} initialScore={sp.score ?? '0'} />
}
