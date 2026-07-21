import { getCustomers } from '@/app/actions/customers'
import { CustomersManager } from '@/components/customers/customers-manager'

export const dynamic = 'force-dynamic'

export default async function CustomersPage(props: {
  searchParams: Promise<{ q?: string; page?: string; score?: string }>
}) {
  const sp = await props.searchParams
  const data = await getCustomers({
    search: sp.q,
    page: sp.page ? Number(sp.page) : 1,
    minScore: sp.score ? Number(sp.score) : 0,
  })

  return <CustomersManager initialData={data} initialSearch={sp.q ?? ''} initialScore={sp.score ?? '0'} />
}
