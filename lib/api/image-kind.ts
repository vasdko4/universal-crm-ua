/**
 * Identify an uploaded image from its bytes, never from `File.type` or the
 * original filename. Both of those are attacker-controlled.
 */

export type ImageKind = 'jpeg' | 'png' | 'webp' | 'gif' | 'avif'

const KIND_TO_MIME: Record<ImageKind, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
}

const KIND_TO_EXT: Record<ImageKind, string> = {
  jpeg: '.jpg',
  png: '.png',
  webp: '.webp',
  gif: '.gif',
  avif: '.avif',
}

export function mimeForImageKind(kind: ImageKind): string {
  return KIND_TO_MIME[kind]
}

export function extForImageKind(kind: ImageKind): string {
  return KIND_TO_EXT[kind]
}

/**
 * Magic-byte sniff. Returns null when the buffer is not a recognised still
 * image — HTML/SVG/PDF prefixed with a fake Content-Type must not pass.
 */
export function detectImageKind(buf: Uint8Array): ImageKind | null {
  if (buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg'
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png'
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'gif'
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...buf.subarray(start, end))
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp'
  // ISO BMFF: size(4) + 'ftyp' + brand(4)
  if (ascii(4, 8) === 'ftyp') {
    const brand = ascii(8, 12)
    if (brand === 'avif' || brand === 'avis') return 'avif'
  }
  return null
}
