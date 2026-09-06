import { getArticles, getArticleCategories } from '@/app/actions/articles'
import { ArticlesManager } from '@/components/articles/articles-manager'
import { requirePermission } from '@/lib/session'
import { parsePage, parsePositiveInt } from '@/lib/api/helpers'

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
      categoryId: parsePositiveInt(sp.category) ?? 'all',
      page: parsePage(sp.page),
    }),
    getArticleCategories(),
  ])

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <ArticlesManager initialData={data} categories={categories} />
    </div>
  )
}
