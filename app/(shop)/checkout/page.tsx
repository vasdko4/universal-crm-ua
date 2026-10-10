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
import { getShopUser } from '@/lib/session'
import { publicRequisitesFromConfig } from '@/lib/payments/public-requisites'
import { localizedPath } from '@/lib/i18n/config'

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
  const [delivery, payment, gateways, savedAddresses, settings, shopUser] = await Promise.all([
    getActiveDeliveryMethods(),
    getActivePaymentMethods(),
    getActiveGateways(),
    getUserAddresses(),
    getPublicStoreSettings().catch(() => null),
    getShopUser().catch(() => null),
  ])
  const gaId = settings?.googleAds.gaEnabled ? settings.googleAds.gaMeasurementId : undefined

  // Trust block data: seller identity + policy links on the transactional page.
  // Merchant Center "misrepresentation" reviews check that the checkout shows
  // who the seller is and where the return policy lives.
  const sellerPhone = (settings?.contact?.phones || []).find((p: string) => p?.trim())?.trim()
  const sellerAddress = settings?.contact?.address?.trim()
  const sellerLine = [settings?.storeName, sellerAddress, sellerPhone].filter(Boolean).join(' · ')
  const trustLinks = [
    { href: localizedPath('/povernennya', locale), label: locale === 'ru' ? 'Возврат товара — 14 дней' : 'Повернення товару — 14 днів' },
    { href: localizedPath('/dostavka-i-oplata', locale), label: locale === 'ru' ? 'Доставка и оплата' : 'Доставка і оплата' },
    { href: localizedPath('/kontakty', locale), label: locale === 'ru' ? 'Контакты' : 'Контакти' },
  ]

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
    .map((p) => ({
      code: p.code,
      name: p.name,
      requisites: p.code === 'requisites' ? publicRequisitesFromConfig(p.config as Record<string, unknown>) : null,
    }))

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
        initialPhone={shopUser?.phone ?? undefined}
        initialName={shopUser?.name ?? undefined}
        initialEmail={shopUser?.email ?? undefined}
      />
      <section className="mt-10 rounded-lg border border-border bg-muted/40 p-5 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {trustLinks.map((l) => (
            <a key={l.href} href={l.href} className="underline underline-offset-2 hover:text-foreground">
              {l.label}
            </a>
          ))}
        </div>
        {sellerLine ? <p className="mt-3">{sellerLine}</p> : null}
      </section>
    </div>
  )
}
