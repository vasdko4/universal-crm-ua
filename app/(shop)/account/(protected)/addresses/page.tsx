import type { Metadata } from 'next'
import { getUserAddresses } from '@/app/actions/addresses'
import { AddressesManager } from '@/components/shop/addresses-manager'
import { getLocale, getDictionary } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const dict = getDictionary(locale)
  return { title: dict.account.addressesTitle }
}

export default async function AddressesPage() {
  const addresses = await getUserAddresses()
  return <AddressesManager initialAddresses={addresses} />
}
