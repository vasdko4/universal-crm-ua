import { notFound } from 'next/navigation'
import { getProduct } from '@/app/actions/products'
import { getCategories } from '@/app/actions/categories'
import { getGroups, getSiteGroups, getMarketplaceCategories } from '@/app/actions/groups'
import { ProductForm, type ProductFormData } from '@/components/products/product-form'
import { ProductAnalyticsPanel } from '@/components/products/product-analytics-panel'

export const dynamic = 'force-dynamic'

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const productId = Number(id)
  if (!Number.isInteger(productId) || productId <= 0) notFound()

  const [product, categories, groups, siteGroups, marketplaceCategories] = await Promise.all([
    getProduct(productId),
    getCategories(),
    getGroups(),
    getSiteGroups(),
    getMarketplaceCategories(),
  ])

  if (!product) notFound()

  const initial: ProductFormData = {
    id: product.id,
    nameUk: product.nameUk ?? '',
    nameRu: product.nameRu ?? '',
    descriptionUk: product.descriptionUk ?? '',
    descriptionRu: product.descriptionRu ?? '',
    privateNotes: product.privateNotes ?? '',
    salesType: product.salesType ?? 'retail',
    sku: product.sku ?? '',
    barcode: product.barcode ?? '',
    price: product.price ?? '',
    priceFrom: product.priceFrom ?? false,
    currency: product.currency ?? 'UAH',
    oldPrice: product.oldPrice ?? '',
    costPrice: product.costPrice ?? '',
    quantity: String(product.quantity ?? 0),
    unit: product.unit ?? 'шт',
    siteGroupId: product.siteGroupId ? String(product.siteGroupId) : '',
    marketplaceCategoryId: product.marketplaceCategoryId
      ? String(product.marketplaceCategoryId)
      : '',
    width: product.width ?? '',
    height: product.height ?? '',
    length: product.length ?? '',
    weight: product.weight ?? '',
    image: product.image ?? null,
    images: (product.images ?? []) as string[],
    isVisible: product.isVisible ?? true,
    isPopular: product.isPopular ?? false,
    purchasesBoost: String(product.purchasesBoost ?? 0),
    realOrdersCount: product.ordersCount ?? 0,
    metaTitleUk: product.metaTitleUk ?? '',
    metaTitleRu: product.metaTitleRu ?? '',
    metaDescriptionUk: product.metaDescriptionUk ?? '',
    metaDescriptionRu: product.metaDescriptionRu ?? '',
    categoryIds: product.categoryIds,
    groupIds: product.groupIds,
    characteristics: product.characteristics.map((c) => ({ name: c.name, value: c.value })),
    options: (product.options ?? []) as ProductFormData['options'],
    variants: (product.variants ?? []).map((v) => ({
      options: (v.options ?? {}) as Record<string, string>,
      sku: v.sku ?? '',
      price: v.price ?? '',
      oldPrice: v.oldPrice ?? '',
      quantity: v.quantity ?? 0,
      image: v.image ?? '',
    })),
  }

  return (
    <div className="flex flex-col gap-4">
      <ProductAnalyticsPanel productId={product.id} />
      <ProductForm
        initial={initial}
        categories={categories}
        groups={groups}
        siteGroups={siteGroups}
        marketplaceCategories={marketplaceCategories}
      />
    </div>
  )
}
