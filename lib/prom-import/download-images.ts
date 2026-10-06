import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'

const LOCAL_UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'products')
const LOCAL_URL_PREFIX = '/uploads/products/'

const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])
const MAX_BYTES = 8 * 1024 * 1024 // 8 MB

/**
 * Download a remote image and store it locally.
 * Returns the local URL (e.g. /uploads/products/xxx.webp) or null on failure.
 * Remote URLs are never stored — files must live on the VPS.
 */
export async function downloadImageLocally(remoteUrl: string): Promise<string | null> {
  if (!remoteUrl || !/^https?:\/\//i.test(remoteUrl)) return null
  
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)
    
    const res = await fetch(remoteUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PowerFox/1.0)' },
    })
    clearTimeout(timeout)
    
    if (!res.ok) return null
    
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.startsWith('image/')) return null
    
    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.length === 0 || buffer.length > MAX_BYTES) return null
    
    // Determine extension from content-type
    let ext = 'jpg'
    if (contentType.includes('png')) ext = 'png'
    else if (contentType.includes('webp')) ext = 'webp'
    else if (contentType.includes('gif')) ext = 'gif'
    
    await mkdir(LOCAL_UPLOAD_DIR, { recursive: true })
    const fileName = `${Date.now()}-${randomBytes(6).toString('hex')}.${ext}`
    await writeFile(join(LOCAL_UPLOAD_DIR, fileName), buffer)
    
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
