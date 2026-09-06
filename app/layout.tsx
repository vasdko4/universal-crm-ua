import type { Metadata, Viewport } from 'next'
import type React from 'react'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { headers } from 'next/headers'
import { getStoreSettingsInternal } from '@/lib/store-settings'
import { getCanonicalSiteUrl } from '@/lib/seo'
import { getLocale } from '@/lib/i18n/server'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { getAdminUser } from '@/lib/session'
import type { Locale } from '@/lib/i18n/config'
import './globals.css'

async function resolveHtmlLocale(): Promise<Locale> {
  const pathname = (await headers()).get('x-pathname') ?? ''
  if (pathname.startsWith('/admin') || pathname === '/sign-in' || pathname.startsWith('/sign-in/')) {
    const user = await getAdminUser()
    if (user?.locale) return user.locale
  }
  return getLocale()
}

const OG_LOCALE: Record<'uk' | 'ru', string> = { uk: 'uk_UA', ru: 'ru_RU' }

const _geistSans = Geist({ subsets: ['latin', 'cyrillic'] })
const _geistMono = Geist_Mono({ subsets: ['latin'] })

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
}

export async function generateMetadata(): Promise<Metadata> {
  const s = await getStoreSettingsInternal().catch(() => null)
  const siteUrl = await getCanonicalSiteUrl()
  const locale = await resolveHtmlLocale()
  const sd = getDictionary(locale).seoDefaults
  const name = s?.storeName || sd.defaultStoreName
  const seo = s?.seo
  const title = seo?.metaTitle?.trim() || `${name} ${sd.onlineStoreSuffix}`
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
    keywords,
    alternates: {
      canonical: locale === 'ru' ? '/ru' : '/',
      languages: { uk: '/', ru: '/ru', 'x-default': '/' },
    },
    icons: s?.faviconUrl ? { icon: s.faviconUrl } : undefined,
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
  const locale = await resolveHtmlLocale()
  return (
    <html lang={locale} className="bg-background">
      <body className="font-sans antialiased">
        <script src="/dom-patch.js" />
        {process.env.NODE_ENV === 'development' && (
          <script src="/dev-perf-patch.js" />
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
