import type { Metadata } from 'next'
import { getMyPromocodes } from '@/app/actions/customer-promos'
import { PromoList } from '@/components/shop/account/promo-list'

export const metadata: Metadata = {
  title: 'Мои промокоды',
}

export default async function PromocodesPage() {
  const promos = await getMyPromocodes()
  return <PromoList promos={promos} />
}
