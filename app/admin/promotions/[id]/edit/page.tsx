import { notFound } from 'next/navigation'
import { getPromotionById, getTargetOptions } from '@/app/actions/promotions'
import { PromotionForm } from '@/components/promotions/promotion-form'
import { requirePermission } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function EditPromotionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermission('promotions')
  const { id } = await params
  const promotionId = Number(id)
  if (!Number.isInteger(promotionId) || promotionId <= 0) notFound()

  const [promotion, options] = await Promise.all([
    getPromotionById(promotionId),
    getTargetOptions(),
  ])
  if (!promotion) notFound()

  return (
    <PromotionForm
      groups={options.groups}
      products={options.products}
      promotion={promotion}
    />
  )
}
