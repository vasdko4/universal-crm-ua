import type { Metadata } from 'next'
import { getMyPromocodes } from '@/app/actions/customer-promos'
import { PromoList } from '@/components/shop/account/promo-list'
import { getLocale, getDictionary } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const dict = getDictionary(locale)
  return { title: dict.account.promosTitle }
}

export default async function PromocodesPage() {
  const promos = await getMyPromocodes()
  return <PromoList promos={promos} />
}
