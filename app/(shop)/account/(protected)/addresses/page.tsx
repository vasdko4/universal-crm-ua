import { getUserAddresses } from '@/app/actions/addresses'
import { AddressesManager } from '@/components/shop/addresses-manager'

export const dynamic = 'force-dynamic'

export default async function AddressesPage() {
  const addresses = await getUserAddresses()
  return <AddressesManager initialAddresses={addresses} />
}
