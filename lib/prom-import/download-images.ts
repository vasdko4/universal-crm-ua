import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import sharp from 'sharp'
import { buildAllowedImageUrl } from '@/lib/api/safe-image-url'

const LOCAL_UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'products')
const LOCAL_URL_PREFIX = '/uploads/products/'

const MAX_BYTES = 8 * 1024 * 1024 // 8 MB

/**
 * Download a remote image, convert to WebP, and store it locally.
 * Returns the local URL (e.g. /uploads/products/xxx.webp) or null on failure.
 * Remote URLs are never stored — files must live on the VPS.
 */
export async function downloadImageLocally(remoteUrl: string): Promise<string | null> {
  // SSRF guard: only allow-listed image hosts (Prom CDN, Vercel blob) —
  // the raw URL never reaches fetch; the rebuilt URL is a literal origin
  // plus a sanitized path, https-only, no credentials or ports.
  const safeUrl = buildAllowedImageUrl(remoteUrl)
  if (!safeUrl) return null
  
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)
    
    const res = await fetch(safeUrl, {
      signal: controller.signal,
      // Never follow redirects: a 3xx to an internal host would bypass the
      // allow-list above. Redirects land in !res.ok below and are skipped.
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PowerFox/1.0)' },
    })
    clearTimeout(timeout)
    
    if (!res.ok) return null
    
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.startsWith('image/')) return null
    
    // Stream the body with a running size cap instead of buffering the
    // whole response first: a hostile server could otherwise exhaust memory
    // before the 8 MB check ever ran.
    const body = res.body
    if (!body) return null
    const reader = body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_BYTES) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
    }
    const buffer = Buffer.concat(chunks)
    if (buffer.length === 0) return null
    
    // Skip conversion for GIFs (animated) — keep as-is
    const isGif = contentType.includes('gif')
    
    await mkdir(LOCAL_UPLOAD_DIR, { recursive: true })
    const fileName = `${Date.now()}-${randomBytes(6).toString('hex')}.${isGif ? 'gif' : 'webp'}`
    const filePath = join(LOCAL_UPLOAD_DIR, fileName)
    
    if (isGif) {
      await writeFile(filePath, buffer)
    } else {
      const webpBuffer = await sharp(buffer)
        .webp({ quality: 85 })
        .toBuffer()
      await writeFile(filePath, webpBuffer)
      
      // Generate 400px thumbnail for product cards — avoids on-the-fly
      // Next.js resize on first page load (major speedup for catalog)
      const thumbName = fileName.replace(/\.webp$/, '-thumb.webp')
      const thumbBuffer = await sharp(buffer)
        .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 75 })
        .toBuffer()
      await writeFile(join(LOCAL_UPLOAD_DIR, thumbName), thumbBuffer)
    }
    
    return `${LOCAL_URL_PREFIX}${fileName}`
  } catch {
    return null
  }
}

/**
 * Download multiple images, preserving order. Failed downloads are skipped.
 */
export async function downloadImagesLocally(urls: string[]): Promise<string[]> {
  const results: string[] = []
  for (const url of urls) {
    if (!url) continue
    // Already local — keep as-is
    if (url.startsWith('/uploads/')) {
      results.push(url)
      continue
    }
    const local = await downloadImageLocally(url)
    if (local) results.push(local)
  }
  return results
}
