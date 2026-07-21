import { getArticles, getArticleCategories } from '@/app/actions/articles'
import { ArticlesManager } from '@/components/articles/articles-manager'
import { requirePermission } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; category?: string; page?: string }>
}) {
  await requirePermission('articles')
  const sp = await searchParams
  const [data, categories] = await Promise.all([
    getArticles({
      search: sp.q ?? '',
      status: (sp.status as 'all' | 'draft' | 'published') ?? 'all',
      categoryId: sp.category ? Number(sp.category) : 'all',
      page: Number(sp.page ?? '1') || 1,
    }),
    getArticleCategories(),
  ])

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <ArticlesManager initialData={data} categories={categories} />
    </div>
  )
}
