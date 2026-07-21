import { getProducts, type ProductFilters } from '@/app/actions/products'
import { getCategories } from '@/app/actions/categories'
import { ProductsTable } from '@/components/products/products-table'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{
  search?: string
  category?: string
  status?: string
  sort?: string
  page?: string
}>

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams

  const filters: ProductFilters = {
    search: params.search,
    categoryId: params.category ? Number(params.category) : undefined,
    status: (params.status as ProductFilters['status']) || 'all',
    sort: (params.sort as ProductFilters['sort']) || 'newest',
    page: Math.max(1, Number(params.page) || 1),
    perPage: 10,
  }

  const [{ items, total, categoriesByProduct }, categories] = await Promise.all([
    getProducts(filters),
    getCategories(),
  ])

  return (
    <ProductsTable
      products={items}
      total={total}
      categories={categories}
      categoriesByProduct={categoriesByProduct}
      filters={filters}
    />
  )
}
