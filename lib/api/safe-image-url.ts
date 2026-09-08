/** Hosts we are willing to proxy images from (product catalogs + our blob). */
export const EMAIL_IMAGE_ALLOWED_HOSTS = new Set([
  'images.prom.ua',
  'hebbkx1anhila5yf.public.blob.vercel-storage.com',
])

/**
 * Parses `?src=` for the email-image proxy. Rebuilds the URL from an
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
  if (!EMAIL_IMAGE_ALLOWED_HOSTS.has(host)) return null
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return null

  const safe = new URL(`https://${host}`)
  safe.pathname = parsed.pathname
  safe.search = parsed.search
  return safe
}
