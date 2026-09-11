import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function toBase32(buf: Buffer): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31]
  return out
}

function fromBase32(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/g, '').replace(/[\s-]/g, '')
  let bits = 0
  let value = 0
  const bytes: number[] = []
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch)
    if (idx < 0) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

function hotp(secret: Buffer, counter: number, digits = 6): string {
  const buf = Buffer.alloc(8)
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0)
  buf.writeUInt32BE(counter >>> 0, 4)
  const hmac = createHmac('sha1', secret).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  return String(code % 10 ** digits).padStart(digits, '0')
}

/** RFC 6238 TOTP (SHA-1, 30s, 6 digits). */
export function generateTotpSecret(): string {
  return toBase32(randomBytes(20))
}

export function totpAt(secretBase32: string, unixSeconds: number, digits = 6, step = 30): string {
  const counter = Math.floor(unixSeconds / step)
  return hotp(fromBase32(secretBase32), counter, digits)
}

export function verifyTotp(secretBase32: string, code: string, now = Date.now(), window = 1): boolean {
  const trimmed = String(code ?? '').replace(/\s/g, '')
  if (!/^\d{6}$/.test(trimmed)) return false
  const unix = Math.floor(now / 1000)
  const step = 30
  const expected = Buffer.from(trimmed)
  for (let i = -window; i <= window; i++) {
    const candidate = Buffer.from(totpAt(secretBase32, unix + i * step))
    if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) return true
  }
  return false
}

export function otpauthUrl(params: { secret: string; account: string; issuer: string }): string {
  const issuer = encodeURIComponent(params.issuer)
  const account = encodeURIComponent(params.account)
  return `otpauth://totp/${issuer}:${account}?secret=${params.secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`
}

export function twoFactorCookieValue(userId: string, secret: string, sessionId = ''): string {
  return createHmac('sha256', secret).update(`staff-2fa:${userId}:${sessionId}`).digest('hex')
}

export function twoFactorCookieValid(
  userId: string,
  secret: string,
  cookie: string | undefined | null,
  sessionId = '',
): boolean {
  if (!cookie || !sessionId) return false
  const expected = twoFactorCookieValue(userId, secret, sessionId)
  const a = Buffer.from(cookie)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
