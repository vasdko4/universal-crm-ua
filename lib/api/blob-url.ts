/**
 * True only for URLs that actually live in this project's Vercel Blob store.
 *
 * A substring check (`url.includes('…blob.vercel-storage.com')`) would also
 * match attacker-controlled URLs like
 * `https://evil.com/.public.blob.vercel-storage.com/x`, so the hostname is
 * parsed and compared exactly instead. Note this is a best-effort UX gate —
 * the server re-validates before deleting anything.
 */
export function isOwnBlobUrl(raw: string): boolean {
  let host: string
  try {
    host = new URL(raw).hostname.toLowerCase()
  } catch {
    return false
  }
  return host === 'blob.vercel-storage.com' || host.endsWith('.public.blob.vercel-storage.com')
}
