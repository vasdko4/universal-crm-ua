import type React from 'react'
import { redirect } from 'next/navigation'
import { CartProvider } from '@/lib/shop/cart-context'
import { FavoritesProvider } from '@/lib/shop/favorites-context'
import { SiteHeader, type HeaderCategory } from '@/components/shop/site-header'
import { SiteFooter } from '@/components/shop/site-footer'
import { ContactWidgetButton } from '@/components/shop/contact-widget'
import { MobileBottomNav } from '@/components/shop/mobile-bottom-nav'
import { AnalyticsTracker } from '@/components/shop/analytics-tracker'
import { PhoneGuard } from '@/components/shop/auth/phone-guard'
import { AuthDialogProvider } from '@/components/shop/auth/auth-dialog'
import { GoogleTag, GoogleAnalyticsPageview } from '@/components/shop/google-ads'
import { LocaleModal } from '@/components/shop/locale-modal'
import { ModalAdHost } from '@/components/shop/modal-ad'
import { LocaleProvider } from '@/lib/i18n/client'
import { getGoogleAuthEnabled } from '@/app/actions/settings-store'
import { getStoreSettingsInternal } from '@/lib/store-settings'
import { getActiveModalAds } from '@/app/actions/modal-ads'
import { isSetupNeeded } from '@/app/actions/setup'
import { getShopCategories } from '@/lib/shop/queries'
import { getPublishedLegalPages } from '@/lib/shop/pages'
import { getLocale, hasLocaleCookie, getDictionary } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  // Fresh install (no users yet): guide the visitor through the setup wizard.
  if (await isSetupNeeded()) redirect('/setup')

  const [settings, locale, chosenLocale, googleAuthEnabled] = await Promise.all([
    getStoreSettingsInternal().catch(() => null),
    getLocale(),
    hasLocaleCookie(),
    getGoogleAuthEnabled(),
  ])
  const dict = getDictionary(locale)
  const [categoriesRaw, legalLinks, modalAdsList] = await Promise.all([
    getShopCategories(locale).catch(() => []),
    getPublishedLegalPages(locale).catch(() => []),
    getActiveModalAds().catch(() => []),
  ])

  const storeName = settings?.storeName ?? 'Techno Store'
  const template = settings?.activeTemplate ?? 'classic'
  const categories: HeaderCategory[] = categoriesRaw.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    parentId: c.parentId ?? null,
    image: c.image ?? null,
  }))
  const social = {
    instagram: settings?.social.instagram.enabled ? settings.social.instagram.url : undefined,
    telegram: settings?.social.telegram.enabled ? settings.social.telegram.url : undefined,
    viber: settings?.social.viber.enabled ? settings.social.viber.url : undefined,
    tiktok: settings?.social.tiktok.enabled ? settings.social.tiktok.url : undefined,
  }
  // Prefer the public support email from the contact widget; fall back to the
  // transactional sender address when email notifications are enabled.
  const widgetEmail = settings?.contact.widget.channels.email
  const email =
    (widgetEmail?.value.trim() ? widgetEmail.value.trim() : null) ??
    (settings?.emailSettings.enabled ? settings.emailSettings.fromEmail : null)

  return (
    <LocaleProvider locale={locale}>
      <CartProvider gaId={settings?.googleAds.gaEnabled ? settings.googleAds.gaMeasurementId : undefined}>
        <FavoritesProvider>
          <AuthDialogProvider googleEnabled={googleAuthEnabled}>
          <div data-template={template} className="flex min-h-screen flex-col bg-background text-foreground">
            <AnalyticsTracker />
            <GoogleTag
              adsId={settings?.googleAds.enabled ? settings.googleAds.conversionId : undefined}
              gaId={settings?.googleAds.gaEnabled ? settings.googleAds.gaMeasurementId : undefined}
            />
            <GoogleAnalyticsPageview
              gaId={settings?.googleAds.gaEnabled ? settings.googleAds.gaMeasurementId : undefined}
            />
            <SiteHeader
              storeName={storeName}
              logoUrl={settings?.logoUrl ?? null}
              phone={settings?.contact.phones.find((p) => p && p.trim()) ?? null}
              categories={categories}
              googleAuthEnabled={googleAuthEnabled}
            />
            <main className="flex-1">{children}</main>
            <SiteFooter
              storeName={storeName}
              phones={settings?.contact.phones ?? []}
              address={settings?.contact.address ?? null}
              workingHours={settings?.contact.workingHours}
              email={email}
              categories={categories}
              social={social}
              dict={dict}
              legalLinks={legalLinks}
              locale={locale}
            />
          </div>
          <MobileBottomNav googleAuthEnabled={googleAuthEnabled} categories={categories} />
          <PhoneGuard />
          {settings?.contact.widget && <ContactWidgetButton widget={settings.contact.widget} />}
          {!chosenLocale && <LocaleModal defaultLocale={settings?.defaultLocale ?? 'uk'} />}
          {chosenLocale && modalAdsList.length > 0 && <ModalAdHost ads={modalAdsList} />}
          </AuthDialogProvider>
        </FavoritesProvider>
      </CartProvider>
    </LocaleProvider>
  )
}
