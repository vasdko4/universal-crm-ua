import { upgradePromImageUrl } from '@/lib/shop/prom-image'

function isPromCdn(hostname: string): boolean {
  const h = hostname.replace(/\.$/, '').toLowerCase()
  return h === 'images.prom.ua' || h.endsWith('.prom.ua') || h.endsWith('.prom.st')
}

/**
 * Serve Prom.ua photos from our origin so JSON-LD / Merchant Center / OG
 * don't advertise a marketplace CDN. Local and Blob URLs stay as-is.
 */
export function storefrontMediaUrl(siteOrigin: string, src: string | null | undefined): string {
  const origin = siteOrigin.replace(/\/+$/, '')
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
 * Same-origin proxy path for listing/gallery `<Image>` tags. Relative so Next
 * does not fetch images.prom.ua from the browser.
 */
export function promMediaPath(src: string | null | undefined): string | null {
  if (!src) return src ?? null
  if (src.startsWith('/api/media?')) return src
  const upgraded = upgradePromImageUrl(src) ?? src
  if (!/^https?:\/\//i.test(upgraded)) return upgraded
  try {
    if (!isPromCdn(new URL(upgraded).hostname)) return upgraded
  } catch {
    return upgraded
  }
  return `/api/media?src=${encodeURIComponent(upgraded)}`
}

export function promMediaPathList(urls: string[]): string[] {
  return urls.map((u) => promMediaPath(u) ?? u)
}

const ABSOLUTE_URL = /https?:\/\/[^\s"'<>]+/gi

/**
 * Prom import leaves raw `<img src="https://images.prom.ua/...">` in product
 * HTML. Rewrite those onto /api/media so the storefront does not hotlink the
 * marketplace CDN from descriptions.
 */
export function rewritePromHtmlImages(html: string, siteOrigin: string): string {
  if (!html) return html
  return html.replace(ABSOLUTE_URL, (url) => {
    try {
      if (!isPromCdn(new URL(url).hostname)) return url
      return storefrontMediaUrl(siteOrigin, url)
    } catch {
      return url
    }
  })
}
