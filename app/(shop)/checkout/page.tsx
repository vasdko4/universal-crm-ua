import type { Metadata } from 'next'
import { CheckoutFlow } from '@/components/shop/checkout-flow'
import {
  getActiveDeliveryMethods,
  getActivePaymentMethods,
  getActiveGateways,
} from '@/lib/shop/queries'
import { getLocale, getDictionary } from '@/lib/i18n/server'
import { getUserAddresses } from '@/app/actions/addresses'
import { getPublicStoreSettings } from '@/app/actions/settings-store'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const title = locale === 'ru' ? 'Оформление заказа' : 'Оформлення замовлення'
  return {
    title,
    // Checkout is a transactional page — never index it.
    robots: { index: false, follow: false },
  }
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ buynow?: string }>
}) {
  const sp = await searchParams
  const buyNow = sp.buynow === '1'
  const locale = await getLocale()
  const dict = getDictionary(locale)
  const [delivery, payment, gateways, savedAddresses, settings] = await Promise.all([
    getActiveDeliveryMethods(),
    getActivePaymentMethods(),
    getActiveGateways(),
    getUserAddresses(),
    getPublicStoreSettings().catch(() => null),
  ])
  const gaId = settings?.googleAds.gaEnabled ? settings.googleAds.gaMeasurementId : undefined

  const hasGateway = gateways.length > 0

  // SECURITY: never forward the raw `config` column to the client — it's an
  // admin secret store (Nova Poshta apiKey, bank IBAN/EDRPOU for "pay by
  // requisites", future gateway credentials). This is a Server->Client
  // Component boundary, so anything in these props gets serialized into the
  // page payload and is visible to any anonymous visitor (view-source /
  // devtools), regardless of the admin-panel permission system. The
  // checkout UI never actually reads `.config` on either method today, so
  // dropping it is a pure fix with no behavior change.
  const payments = payment
    .filter((p) => (p.code === 'online' ? hasGateway : true))
    .map((p) => ({ code: p.code, name: p.name }))

  const deliveries = delivery.map((d) => ({
    code: d.code,
    name: d.name,
  }))

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:py-12">
      <h1 className="mb-6 text-2xl font-bold text-foreground md:text-3xl">{dict.checkout.title}</h1>
      <CheckoutFlow
        deliveryMethods={deliveries}
        paymentMethods={payments}
        buyNow={buyNow}
        savedAddresses={savedAddresses}
        gaId={gaId}
        minOrder={settings?.minOrder}
      />
    </div>
  )
}
