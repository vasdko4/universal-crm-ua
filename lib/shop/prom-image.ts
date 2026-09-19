/** Prom.ua CDN encodes size in the filename: `755_w700_h500_slug.jpg`. */
const PROM_SIZE = /_w\d+_h\d+_/

function isPromHost(hostname: string): boolean {
  const h = hostname.replace(/\.$/, '').toLowerCase()
  return h === 'images.prom.ua' || h.endsWith('.prom.ua') || h.endsWith('.prom.st')
}

function resizePromUrl(url: string, token: string): string {
  const next = url.replace(PROM_SIZE, token)
  if (next === url) return url
  try {
    const parsed = new URL(url)
    if (!isPromHost(parsed.hostname)) return url
    parsed.pathname = parsed.pathname.replace(PROM_SIZE, token)
    return parsed.toString()
  } catch {
    return next
  }
}

/** Listing / card thumbnail — 400px is enough for a 2-col phone grid. */
export function listingPromImageUrl(url: string | null | undefined): string | null {
  if (!url) return url ?? null
  return resizePromUrl(url, '_w400_h400_')
}

/** Product gallery / OG / Merchant — large enough, not the 4MP original. */
export function upgradePromImageUrl(url: string | null | undefined): string | null {
  if (!url) return url ?? null
  return resizePromUrl(url, '_w1000_h1000_')
}

export function upgradePromImageList(urls: string[]): string[] {
  return urls.map((u) => upgradePromImageUrl(u) ?? u)
}

export function listingPromImageList(urls: string[]): string[] {
  return urls.map((u) => listingPromImageUrl(u) ?? u)
}
