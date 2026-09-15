/**
 * URL / path guards for redirects and window.open(). Scanners flag any
 * window.open(serverValue) as XSS; the real risk is javascript:/data: URLs
 * and protocol-relative open redirects. Keep allowlists tiny.
 */

function hasControlChars(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value)
}

/**
 * Same-origin path for post-login redirects. Rejects protocol-relative
 * (`//evil`), backslash tricks, and encoded `://`.
 */
export function safeInternalPath(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback
  let value = raw.trim()
  try {
    value = decodeURIComponent(value)
  } catch {
    return fallback
  }
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback
  if (value.includes('\\') || value.includes('://') || value.includes('//') || hasControlChars(value)) return fallback
  return value
}

const DEFAULT_OPEN_SCHEMES = new Set(['http:', 'https:'])

/**
 * Relative app paths (`/api/...`) or absolute URLs whose scheme is allowlisted.
 * Returns null when the value must not be handed to window.open / <a href>.
 */
export function safeOpenUrl(
  raw: string | null | undefined,
  extraSchemes: string[] = [],
): string | null {
  if (!raw) return null
  const value = raw.trim()
  if (!value || hasControlChars(value)) return null

  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') && !value.includes('://')) {
    return value
  }

  try {
    const url = new URL(value)
    const allowed = new Set([...DEFAULT_OPEN_SCHEMES, ...extraSchemes])
    if (!allowed.has(url.protocol)) return null
    return url.toString()
  } catch {
    return null
  }
}
