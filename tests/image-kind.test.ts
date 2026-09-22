import { describe, it, expect } from 'vitest'
import { detectImageKind, extForImageKind, mimeForImageKind } from '@/lib/api/image-kind'

describe('detectImageKind', () => {
  it('recognises JPEG / PNG / GIF / WebP / AVIF magic bytes', () => {
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
    const gif = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0])
    const webp = Uint8Array.from(Buffer.from('RIFF....WEBP', 'ascii'))
    const avif = Uint8Array.from([
      0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66,
    ])
    expect(detectImageKind(jpeg)).toBe('jpeg')
    expect(detectImageKind(png)).toBe('png')
    expect(detectImageKind(gif)).toBe('gif')
    expect(detectImageKind(webp)).toBe('webp')
    expect(detectImageKind(avif)).toBe('avif')
  })

  it('rejects HTML spoofed as an image', () => {
    const html = Uint8Array.from(Buffer.from('<!doctype html><img src=x>', 'utf8'))
    expect(detectImageKind(html)).toBeNull()
    expect(detectImageKind(new Uint8Array(8))).toBeNull()
  })

  it('maps kinds to a generated extension, never the original name', () => {
    expect(extForImageKind('jpeg')).toBe('.jpg')
    expect(mimeForImageKind('webp')).toBe('image/webp')
  })
})
