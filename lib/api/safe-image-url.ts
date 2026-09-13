const IMAGES_PROM_UA = 'https://images.prom.ua'
const CDN_PROM_ST = 'https://cdn.prom.st'
const IMAGES_PROM_ST = 'https://images.prom.st'
const BLOB_PUBLIC_SUFFIX = '.public.blob.vercel-storage.com'
const BLOB_SUFFIX = '.blob.vercel-storage.com'

const SAFE_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

/**
 * Map a hostname onto a server-controlled https origin. The returned string
 * is always a literal (or a literal suffix plus a DNS-label subdomain) so
 * CodeQL does not treat it as attacker-controlled (js/request-forgery).
 */
export function allowedImageOrigin(hostname: string): string | null {
  const host = hostname.replace(/\.$/, '').toLowerCase()
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return null
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(':')) return null

  switch (host) {
    case 'images.prom.ua':
      return IMAGES_PROM_UA
    case 'cdn.prom.st':
      return CDN_PROM_ST
    case 'images.prom.st':
      return IMAGES_PROM_ST
    default:
      break
  }

  if (host.endsWith('.prom.ua')) {
    const sub = host.slice(0, -'.prom.ua'.length)
    if (SAFE_LABEL.test(sub) && !sub.includes('.')) return `https://${sub}.prom.ua`
    return null
  }
  if (host.endsWith('.prom.st')) {
    const sub = host.slice(0, -'.prom.st'.length)
    if (SAFE_LABEL.test(sub) && !sub.includes('.')) return `https://${sub}.prom.st`
    return null
  }

  if (host.endsWith(BLOB_PUBLIC_SUFFIX)) {
    const sub = host.slice(0, -BLOB_PUBLIC_SUFFIX.length)
    if (SAFE_LABEL.test(sub)) return `https://${sub}${BLOB_PUBLIC_SUFFIX}`
    return null
  }
  if (host.endsWith(BLOB_SUFFIX)) {
    const sub = host.slice(0, -BLOB_SUFFIX.length)
    if (SAFE_LABEL.test(sub) && !sub.includes('.')) return `https://${sub}${BLOB_SUFFIX}`
  }
  return null
}

export function isAllowedImageHost(hostname: string): boolean {
  return allowedImageOrigin(hostname) != null
}

/** @deprecated Use isAllowedImageHost. Kept for callers that imported the Set. */
export const EMAIL_IMAGE_ALLOWED_HOSTS = new Set([
  'images.prom.ua',
  'hebbkx1anhila5yf.public.blob.vercel-storage.com',
])

function sanitizeImagePath(pathname: string): string | null {
  if (!pathname.startsWith('/') || pathname.length > 1024) return null
  if (pathname.includes('\\') || pathname.includes('\0') || pathname.includes('@')) return null
  let decoded = pathname
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }
  if (
    decoded.includes('..') ||
    decoded.includes('//') ||
    decoded.includes('\\') ||
    decoded.includes('\0') ||
    decoded.includes('@')
  ) {
    return null
  }
  return pathname
}

/**
 * Rebuilds `?src=` as `literalOrigin + sanitizedPath + search`.
 * The original user string never reaches fetch (CodeQL SSRF).
 */
export function buildAllowedImageUrl(src: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(src)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:') return null
  if (parsed.username || parsed.password) return null
  if (parsed.port && parsed.port !== '443') return null

  const origin = allowedImageOrigin(parsed.hostname)
  if (!origin) return null
  if (parsed.pathname.includes('..')) return null
  const path = sanitizeImagePath(parsed.pathname)
  if (!path) return null
  if (parsed.search.length > 512) return null
  return origin + path + parsed.search
}

/**
 * Parses `?src=` for the image proxy. Rebuilds the URL from an
 * allowlisted hostname so the original user string never reaches fetch
 * (CodeQL SSRF). Rejects credentials, non-https, ports, and unknown hosts.
 */
export function parseAllowedImageUrl(src: string): URL | null {
  const built = buildAllowedImageUrl(src)
  if (!built) return null
  try {
    return new URL(built)
  } catch {
    return null
  }
}
