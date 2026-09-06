import { getPages } from '@/app/actions/pages'
import { PagesManager } from '@/components/pages/pages-manager'
import { requirePermission } from '@/lib/session'
import { parsePage } from '@/lib/api/helpers'

export const dynamic = 'force-dynamic'

export default async function PagesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>
}) {
  await requirePermission('pages')
  const sp = await searchParams
  const data = await getPages({
    search: sp.q ?? '',
    status: (sp.status as 'all' | 'draft' | 'published') ?? 'all',
    page: parsePage(sp.page),
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <PagesManager initialData={data} />
    </div>
  )
}
