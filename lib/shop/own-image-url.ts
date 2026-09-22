import { listingPromImageUrl, upgradePromImageUrl } from '@/lib/shop/prom-image'
import { stripTrailingSlashes } from '@/lib/text'

function isPromCdn(hostname: string): boolean {
  const h = hostname.replace(/\.$/, '').toLowerCase()
  return h === 'images.prom.ua' || h.endsWith('.prom.ua') || h.endsWith('.prom.st')
}

function proxyPromPath(src: string): string {
  try {
    if (!isPromCdn(new URL(src).hostname)) return src
    return `/api/media?src=${encodeURIComponent(src)}`
  } catch {
    return src
  }
}

/** True when `<Image>` must skip the optimizer (query string on `/api/media`). */
export function isProxiedMedia(src: string | null | undefined): boolean {
  return typeof src === 'string' && src.startsWith('/api/media')
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
  const proxied = proxyPromPath(upgraded)
  if (proxied.startsWith('/')) return `${origin}${proxied}`
  return proxied
}

/**
 * Listing/gallery `<Image>` src. Prom CDN URLs go through `/api/media` so the
 * HTML (and `_next/image?url=`) never names images.prom.ua.
 */
export function promMediaPath(src: string | null | undefined): string | null {
  if (!src) return src ?? null
  if (src.startsWith('/api/media?')) return src
  return proxyPromPath(listingPromImageUrl(src) ?? src)
}

export function promMediaPathList(urls: string[]): string[] {
  return urls.map((u) => promMediaPath(u) ?? u)
}

/** Product page gallery — 1000px Prom derivative, same-origin proxy. */
export function galleryMediaPath(src: string | null | undefined): string | null {
  if (!src) return src ?? null
  if (src.startsWith('/api/media?')) return src
  return proxyPromPath(upgradePromImageUrl(src) ?? src)
}

export function galleryMediaPathList(urls: string[]): string[] {
  return urls.map((u) => galleryMediaPath(u) ?? u)
}

const ABSOLUTE_URL = /https?:\/\/[^\s"'<>]+/gi

/**
 * Prom import leaves raw `<img src="https://images.prom.ua/...">` in product
 * HTML. Point those at `/api/media` so description images match CSP.
 */
export function rewritePromHtmlImages(html: string, _siteOrigin: string): string {
  if (!html) return html
  return html.replace(ABSOLUTE_URL, (url) => {
    try {
      if (!isPromCdn(new URL(url).hostname)) return url
      return proxyPromPath(upgradePromImageUrl(url) ?? url)
    } catch {
      return url
    }
  })
}
