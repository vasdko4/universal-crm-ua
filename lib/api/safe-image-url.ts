/** Hosts we are willing to proxy images from (product catalogs + our blob). */
export function isAllowedImageHost(hostname: string): boolean {
  const host = hostname.replace(/\.$/, '').toLowerCase()
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return false
  if (host === 'images.prom.ua' || host.endsWith('.prom.ua') || host.endsWith('.prom.st')) return true
  if (host.endsWith('.blob.vercel-storage.com') || host.endsWith('.public.blob.vercel-storage.com')) return true
  return false
}

/** @deprecated Use isAllowedImageHost. Kept for callers that imported the Set. */
export const EMAIL_IMAGE_ALLOWED_HOSTS = new Set([
  'images.prom.ua',
  'hebbkx1anhila5yf.public.blob.vercel-storage.com',
])

/**
 * Parses `?src=` for the image proxy. Rebuilds the URL from an
 * allowlisted hostname so the original user string never reaches fetch
 * (CodeQL SSRF). Rejects credentials, non-https, ports, and unknown hosts.
 */
export function parseAllowedImageUrl(src: string): URL | null {
  let parsed: URL
  try {
    parsed = new URL(src)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:') return null
  if (parsed.username || parsed.password) return null
  if (parsed.port && parsed.port !== '443') return null
  const host = parsed.hostname.replace(/\.$/, '').toLowerCase()
  if (!isAllowedImageHost(host)) return null

  const safe = new URL(`https://${host}`)
  safe.pathname = parsed.pathname
  safe.search = parsed.search
  return safe
}
