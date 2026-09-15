import { listingPromImageUrl, upgradePromImageUrl } from '@/lib/shop/prom-image'
import { stripTrailingSlashes } from '@/lib/text'

function isPromCdn(hostname: string): boolean {
  const h = hostname.replace(/\.$/, '').toLowerCase()
  return h === 'images.prom.ua' || h.endsWith('.prom.ua') || h.endsWith('.prom.st')
}

/**
 * Serve Prom.ua photos from our origin so JSON-LD / Merchant Center / OG
 * don't advertise a marketplace CDN. Local and Blob URLs stay as-is.
 */
export function storefrontMediaUrl(siteOrigin: string, src: string | null | undefined): string {
  const origin = stripTrailingSlashes(siteOrigin)
  if (!src) return origin
  const abs = /^https?:\/\//i.test(src)
    ? src
    : `${origin}${src.startsWith('/') ? '' : '/'}${src}`
  const upgraded = upgradePromImageUrl(abs) ?? abs
  try {
    const host = new URL(upgraded).hostname
    if (!isPromCdn(host)) return upgraded
  } catch {
    return upgraded
  }
  return `${origin}/api/media?src=${encodeURIComponent(upgraded)}`
}

/**
 * Listing/gallery `<Image>` src. Prom CDN URLs stay on Prom so Next's
 * optimizer fetches them in one hop (remotePatterns). /api/media is only
 * for JSON-LD / OG / Merchant, where we must not advertise the marketplace.
 */
export function promMediaPath(src: string | null | undefined): string | null {
  if (!src) return src ?? null
  if (src.startsWith('/api/media?')) return src
  return listingPromImageUrl(src) ?? src
}

export function promMediaPathList(urls: string[]): string[] {
  return urls.map((u) => promMediaPath(u) ?? u)
}

/** Product page gallery — 1000px Prom derivative, still one hop to the CDN. */
export function galleryMediaPath(src: string | null | undefined): string | null {
  if (!src) return src ?? null
  if (src.startsWith('/api/media?')) return src
  return upgradePromImageUrl(src) ?? src
}

export function galleryMediaPathList(urls: string[]): string[] {
  return urls.map((u) => galleryMediaPath(u) ?? u)
}

const ABSOLUTE_URL = /https?:\/\/[^\s"'<>]+/gi

/**
 * Prom import leaves raw `<img src="https://images.prom.ua/...">` in product
 * HTML. Keep those on Prom (resized) so description images are not proxied
 * twice through /api/media + /_next/image.
 */
export function rewritePromHtmlImages(html: string, _siteOrigin: string): string {
  if (!html) return html
  return html.replace(ABSOLUTE_URL, (url) => {
    try {
      if (!isPromCdn(new URL(url).hostname)) return url
      return upgradePromImageUrl(url) ?? url
    } catch {
      return url
    }
  })
}
