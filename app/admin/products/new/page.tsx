import { getCategories } from '@/app/actions/categories'
import { getGroups, getSiteGroups, getMarketplaceCategories } from '@/app/actions/groups'
import { ProductForm, emptyProduct } from '@/components/products/product-form'

export const dynamic = 'force-dynamic'

export default async function NewProductPage() {
  const [categories, groups, siteGroups, marketplaceCategories] = await Promise.all([
    getCategories(),
    getGroups(),
    getSiteGroups(),
    getMarketplaceCategories(),
  ])

  return (
    <ProductForm
      initial={emptyProduct}
      categories={categories}
      groups={groups}
      siteGroups={siteGroups}
      marketplaceCategories={marketplaceCategories}
    />
  )
}
