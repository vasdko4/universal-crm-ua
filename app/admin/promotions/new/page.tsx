import { getTargetOptions } from '@/app/actions/promotions'
import { PromotionForm } from '@/components/promotions/promotion-form'
import { requireWritePermission } from '@/lib/session'

export default async function NewPromotionPage() {
  await requireWritePermission('promotions')
  const options = await getTargetOptions()
  return <PromotionForm groups={options.groups} products={options.products} />
}
