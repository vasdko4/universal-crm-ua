import type { Metadata, Viewport } from 'next'
import type React from 'react'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { getStoreSettingsInternal } from '@/lib/store-settings'
import { getCanonicalSiteUrl } from '@/lib/seo'
import { getLocale } from '@/lib/i18n/server'
import './globals.css'

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
  const locale = await getLocale()
  const name = s?.storeName || 'Интернет-магазин'
  const seo = s?.seo
  const title = seo?.metaTitle?.trim() || `${name} — интернет-магазин`
  const description =
    seo?.metaDescription?.trim() ||
    s?.storeDescription ||
    'Качественные товары от проверенных брендов. Доставка по всей Украине и гарантия на каждый товар.'
  const keywords = seo?.keywords?.trim()
    ? seo.keywords.split(',').map((k) => k.trim()).filter(Boolean)
    : ['интернет-магазин', name]
  const indexable = seo?.indexingEnabled !== false

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
      images: [{ url: '/hero-electronics.png', width: 1200, height: 630, alt: name }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/hero-electronics.png'],
    },
  }
}

// Dev-only workaround for a known Next.js/React bug: React's experimental
// component performance tracking may call performance.measure() with a
// negative timestamp when notFound() or an aborted render happens on a
// dynamic route ("'ProductPage' cannot have a negative time stamp").
// This swallows only that specific error; all other errors pass through.
// Safe to remove once the fix lands upstream in a future Next.js release.
const devPerfPatch = `(function(){try{var p=window.performance;if(!p||typeof p.measure!=='function'||p.__v0Patched)return;var o=p.measure.bind(p);p.measure=function(){try{return o.apply(p,arguments)}catch(e){if(e&&e.message&&e.message.indexOf('negative time stamp')!==-1)return;throw e}};p.__v0Patched=true}catch(_){}})();`

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reflect the visitor's actual selected locale (defaults to 'uk', the
  // store's default locale) — this was hardcoded to "ru" regardless of the
  // selected/default locale, which misleads screen readers and can cause
  // search engines to classify Ukrainian-language pages as Russian.
  const locale = await getLocale()
  return (
    <html lang={locale} className="bg-background">
      <body className="font-sans antialiased">
        {process.env.NODE_ENV === 'development' && (
          // eslint-disable-next-line react/no-danger
          <script dangerouslySetInnerHTML={{ __html: devPerfPatch }} />
        )}
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  )
}
