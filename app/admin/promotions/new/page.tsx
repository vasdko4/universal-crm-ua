import { getTargetOptions } from '@/app/actions/promotions'
import { PromotionForm } from '@/components/promotions/promotion-form'

export const metadata = { title: 'Новая акция · Magazine CRM' }

export default async function NewPromotionPage() {
  const options = await getTargetOptions()
  return <PromotionForm groups={options.groups} products={options.products} />
}
