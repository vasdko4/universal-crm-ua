import { describe, it, expect } from 'vitest'
import { isOwnBlobUrl } from '@/lib/api/blob-url'

describe('isOwnBlobUrl', () => {
  it('accepts our own blob store URLs', () => {
    expect(isOwnBlobUrl('https://abc123.public.blob.vercel-storage.com/photo.webp')).toBe(true)
    expect(isOwnBlobUrl('https://blob.vercel-storage.com/photo.webp')).toBe(true)
  })

  it('rejects attacker URLs that merely contain the blob domain as substring', () => {
    expect(isOwnBlobUrl('https://evil.com/.public.blob.vercel-storage.com/x')).toBe(false)
    expect(isOwnBlobUrl('https://evil.com/?x=.public.blob.vercel-storage.com')).toBe(false)
    expect(isOwnBlobUrl('https://notblobvercelstorage.com/x')).toBe(false)
  })

  it('rejects non-URLs and relative paths', () => {
    expect(isOwnBlobUrl('not a url')).toBe(false)
    expect(isOwnBlobUrl('/uploads/products/a.webp')).toBe(false)
    expect(isOwnBlobUrl('')).toBe(false)
  })
})
