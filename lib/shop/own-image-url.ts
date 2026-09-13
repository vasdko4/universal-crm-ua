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
