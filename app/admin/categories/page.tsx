import { getCategories } from '@/app/actions/categories'
import { CategoriesManager } from '@/components/categories-manager'
import { requirePermission } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function CategoriesPage() {
  await requirePermission('categories')
  const categories = await getCategories()
  return <CategoriesManager categories={categories} />
}
