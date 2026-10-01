import type { Metadata, Viewport } from 'next'
import type React from 'react'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { getStoreSettingsInternal } from '@/lib/store-settings'
import { getCanonicalSiteUrl } from '@/lib/seo'
import { headers } from 'next/headers'
import { getLocale } from '@/lib/i18n/server'
import { getDictionary } from '@/lib/i18n/dictionaries'
import Script from 'next/script'
import './globals.css'

const OG_LOCALE: Record<'uk' | 'ru', string> = { uk: 'uk_UA', ru: 'ru_RU' }

const _geistSans = Geist({ subsets: ['latin', 'cyrillic'] })
const _geistMono = Geist_Mono({ subsets: ['latin'] })

export const viewport: Viewport = {
  // Matches the storefront's primary brand color (classic template) so the
  // browser chrome matches the app when it is installed / launched as a PWA.
  themeColor: '#00706b',
  width: 'device-width',
  initialScale: 1,
}

export async function generateMetadata(): Promise<Metadata> {
  const s = await getStoreSettingsInternal().catch(() => null)
  const siteUrl = await getCanonicalSiteUrl()
  const locale = await getLocale()
  const sd = getDictionary(locale).seoDefaults
  const name = (s?.storeName?.trim() || sd.defaultStoreName).trim()
  const seo = s?.seo
  const suffix = sd.onlineStoreSuffix.trim()
  const suffixBare = suffix.replace(/^[\s\u2014\u2013\-]+/, '').trim().toLowerCase()
  const nameLc = name.toLowerCase()
  const composed =
    !suffix || nameLc === suffixBare || nameLc.includes(suffixBare)
      ? name
      : `${name} ${suffix}`
  const title = seo?.metaTitle?.trim() || composed
  // Admin SEO is a single global string (usually Ukrainian). On /ru use the
  // Russian dictionary defaults so the <meta description> matches the page.
  const description =
    locale === 'ru'
      ? sd.defaultDescription
      : seo?.metaDescription?.trim() || s?.storeDescription || sd.defaultDescription
  const keywords = seo?.keywords?.trim()
    ? seo.keywords.split(',').map((k) => k.trim()).filter(Boolean)
    : [sd.defaultKeyword, name]
  const indexable = seo?.indexingEnabled !== false
  const ogImage = seo?.ogImageUrl?.trim() || '/hero-electronics.png'

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: title,
      template: `%s — ${name}`,
    },
    description,
    applicationName: name,
    // Installable PWA: no service worker (avoids breaking checkout caching).
    manifest: '/manifest.webmanifest',
    appleWebApp: {
      capable: true,
      title: name,
      statusBarStyle: 'default',
    },
    formatDetection: {
      telephone: false,
    },
    keywords,
    alternates: {
      canonical: locale === 'ru' ? '/ru' : '/',
      languages: { uk: '/', ru: '/ru', 'x-default': '/' },
    },
    icons: {
      icon: s?.faviconUrl?.trim() || '/icon.png',
      shortcut: s?.faviconUrl?.trim() || '/icon.png',
      apple: [
        { url: s?.faviconUrl?.trim() || '/icon.png' },
        // Touch icon for "Add to Home Screen" (PWA icon set).
        { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      ],
    },
    verification: seo?.googleVerification?.trim()
      ? { google: seo.googleVerification.trim() }
      : undefined,
    robots: {
      index: indexable,
      follow: indexable,
      googleBot: { index: indexable, follow: indexable, 'max-image-preview': 'large', 'max-snippet': -1 },
    },
    openGraph: {
      type: 'website',
      siteName: name,
      title,
      description,
      url: siteUrl,
      locale: OG_LOCALE[locale],
      images: [{ url: ogImage, width: 1200, height: 630, alt: name }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reflect the visitor's actual selected locale (defaults to 'uk', the
  // store's default locale) — this was hardcoded to "ru" regardless of the
  // selected/default locale, which misleads screen readers and can cause
  // search engines to classify Ukrainian-language pages as Russian.
  const locale = await getLocale()
  const nonce = (await headers()).get('x-nonce') ?? undefined
  return (
    <html lang={locale} className="bg-background">
      <body className="font-sans antialiased">
        <Script src="/dom-patch.js" nonce={nonce} strategy="beforeInteractive" />
        {process.env.NODE_ENV === 'development' && (
          <Script src="/dev-perf-patch.js" nonce={nonce} strategy="beforeInteractive" />
        )}
        {children}
        {/* On mobile Sonner ignores `position` and always renders toasts
            full-width at the bottom of the viewport, which otherwise sits on
            top of the fixed mobile bottom nav bar (`MobileBottomNav`, h-16 +
            safe-area) and blocks its cart/checkout tap targets right after
            "added to cart" fires. `mobileOffset` lifts toasts above it. */}
        <Toaster
          position="bottom-right"
          richColors
          mobileOffset={{ bottom: 'calc(4rem + env(safe-area-inset-bottom) + 12px)' }}
        />
      </body>
    </html>
  )
}
