import { ok, fail } from '@/lib/api/helpers'
import { isRateLimited, clientIp } from '@/lib/api/rate-limit'
import {
  getActiveDeliveryMethods,
  getActivePaymentMethods,
  getActiveGateways,
} from '@/lib/shop/queries'
import { getPublicStoreSettings } from '@/app/actions/settings-store'

/**
 * GET /api/v1/store — public store meta for the Android shop app.
 * Same sources as the web checkout page (app/(shop)/checkout/page.tsx):
 * getActiveDeliveryMethods / getActivePaymentMethods / getPublicStoreSettings.
 *
 * SECURITY: the method rows carry a `config` column that is an admin secret
 * store (Nova Poshta apiKey, bank IBAN/EDRPOU, gateway credentials). It is
 * projected away here — the response carries code+name only, exactly like
 * the checkout page does at its Server->Client boundary.
 */
export async function GET(request: Request) {
  if (await isRateLimited('v1-store', clientIp(request), 60)) {
    return fail('rate_limited', 429)
  }
  const [settings, delivery, payment, gateways] = await Promise.all([
    getPublicStoreSettings(),
    getActiveDeliveryMethods(),
    getActivePaymentMethods(),
    getActiveGateways(),
  ])

  const deliveryMethods = delivery.map((d) => ({ code: d.code, name: d.name }))
  // The web checkout hides the online method when no gateway is configured
  // — it cannot be used. Mirror that here so the app never offers a dead
  // payment method.
  const hasGateway = gateways.length > 0
  const paymentMethods = payment
    .filter((p) => (p.code === 'online' ? hasGateway : true))
    .map((p) => ({ code: p.code, name: p.name }))

  const phone = (settings.contact.phones || []).find((p) => p?.trim())?.trim()
  const address = settings.contact.address?.trim()
  // Same email precedence as the shop footer (app/(shop)/layout.tsx):
  // public support email from the contact widget, else the transactional
  // sender address when email notifications are enabled.
  const widgetEmail = settings.contact.widget.channels.email?.value?.trim()
  const email =
    widgetEmail || (settings.emailSettings.enabled ? settings.emailSettings.fromEmail : null) || undefined

  return ok({
    name: settings.storeName?.trim() || 'Мій магазин',
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
    ...(address ? { address } : {}),
    // The store has a single currency; products default to UAH
    // (see lib/db/schema.ts). No currency setting exists.
    currency: 'UAH',
    deliveryMethods,
    paymentMethods,
  })
}
