/** Prom.ua CDN encodes size in the filename: `755_w700_h500_slug.jpg`. */
const PROM_SIZE = /_w\d+_h\d+_/
const LARGE = '_w2000_h2000_'

function isPromHost(hostname: string): boolean {
  const h = hostname.replace(/\.$/, '').toLowerCase()
  return h === 'images.prom.ua' || h.endsWith('.prom.ua') || h.endsWith('.prom.st')
}

/** Prefer the large Prom derivative over the 700×500 listing thumbnail. */
export function upgradePromImageUrl(url: string | null | undefined): string | null {
  if (!url) return url ?? null
  const next = url.replace(PROM_SIZE, LARGE)
  if (next === url) return url
  try {
    const parsed = new URL(url)
    if (!isPromHost(parsed.hostname)) return url
    parsed.pathname = parsed.pathname.replace(PROM_SIZE, LARGE)
    return parsed.toString()
  } catch {
    return next
  }
}

export function upgradePromImageList(urls: string[]): string[] {
  return urls.map((u) => upgradePromImageUrl(u) ?? u)
}
