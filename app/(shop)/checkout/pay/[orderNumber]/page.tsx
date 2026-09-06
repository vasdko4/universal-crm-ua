import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getOrderByNumber } from '@/app/actions/shop'
import { PayForm } from '@/components/shop/pay-form'
import { getLocale } from '@/lib/i18n/server'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orderNumber: string }>
}): Promise<Metadata> {
  const { orderNumber } = await params
  const data = await getOrderByNumber(orderNumber)
  if (!data) notFound()
  const locale = await getLocale()
  return {
    title: locale === 'ru' ? 'Оплата заказа' : 'Оплата замовлення',
    robots: { index: false, follow: false },
  }
}

export const dynamic = 'force-dynamic'

export default async function PayPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>
}) {
  const { orderNumber } = await params
  const data = await getOrderByNumber(orderNumber)
  if (!data) notFound()

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10 md:py-16">
      <PayForm
        orderNumber={data.order.orderNumber}
        total={Number(data.order.total)}
        paid={data.order.paymentStatus === 'paid'}
        gatewayCode={data.payment?.gatewayCode ?? null}
        gatewayPaymentUrl={data.payment?.paymentUrl ?? null}
        paymentStatus={data.payment?.status ?? null}
      />
    </div>
  )
}
