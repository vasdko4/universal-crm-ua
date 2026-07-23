import type { Metadata, Viewport } from 'next'
import type React from 'react'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { getStoreSettingsInternal } from '@/lib/store-settings'
import { getCanonicalSiteUrl } from '@/lib/seo'
import { getLocale } from '@/lib/i18n/server'
import { getDictionary } from '@/lib/i18n/dictionaries'
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
  const sd = getDictionary(locale).seoDefaults
  const name = s?.storeName || sd.defaultStoreName
  const seo = s?.seo
  const title = seo?.metaTitle?.trim() || `${name} ${sd.onlineStoreSuffix}`
  const description = seo?.metaDescription?.trim() || s?.storeDescription || sd.defaultDescription
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

// Dev-only workaround for a known Next.js/React bug: React's experimental
// component performance tracking may call performance.measure() with a
// negative timestamp when notFound() or an aborted render happens on a
// dynamic route ("'ProductPage' cannot have a negative time stamp").
// This swallows only that specific error; all other errors pass through.
// Safe to remove once the fix lands upstream in a future Next.js release.
const devPerfPatch = `(function(){try{var p=window.performance;if(!p||typeof p.measure!=='function'||p.__v0Patched)return;var o=p.measure.bind(p);p.measure=function(){try{return o.apply(p,arguments)}catch(e){if(e&&e.message&&e.message.indexOf('negative time stamp')!==-1)return;throw e}};p.__v0Patched=true}catch(_){}})();`

// Fix for a common browser-extension conflict (Grammarly, Google Translate,
// password managers, etc.): these tools inject/move DOM nodes inside React's
// tree behind its back. When React later tries to remove/insert a node it
// thinks is still there, the browser throws "Failed to execute 'removeChild'/
// 'insertBefore' on 'Node': ... is not a child of this node." React treats
// this as a render error and the whole page crashes to app/error.tsx, even
// though nothing is actually broken. This patches the two DOM methods to
// no-op instead of throwing when the node isn't actually a child — the
// standard, widely-used mitigation for this class of bug. Runs on every
// environment (prod included), since it's the browser extension timing that
// triggers it, not app code.
const domPatch = `(function(){try{if(window.__domPatched)return;window.__domPatched=true;var rc=Node.prototype.removeChild;Node.prototype.removeChild=function(child){if(child&&child.parentNode!==this){return child}return rc.apply(this,arguments)};var ib=Node.prototype.insertBefore;Node.prototype.insertBefore=function(newNode,refNode){if(refNode&&refNode.parentNode!==this){this.appendChild(newNode);return newNode}return ib.apply(this,arguments)}}catch(_){}})();`

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reflect the visitor's actual selected locale (defaults to 'uk', the
  // store's default locale) — this was hardcoded to "ru" regardless of the
  // selected/default locale, which misleads screen readers and can cause
  // search engines to classify Ukrainian-language pages as Russian.
  const locale = await getLocale()
  return (
    <html lang={locale} className="bg-background">
      <body className="font-sans antialiased">
        {/* eslint-disable-next-line react/no-danger */}
        <script dangerouslySetInnerHTML={{ __html: domPatch }} />
        {process.env.NODE_ENV === 'development' && (
          // eslint-disable-next-line react/no-danger
          <script dangerouslySetInnerHTML={{ __html: devPerfPatch }} />
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
