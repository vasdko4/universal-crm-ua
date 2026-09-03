// Ukrainian phone normalization to +380XXXXXXXXX.
export function normalizeUaPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('380')) return '+' + digits
  if (digits.length === 11 && digits.startsWith('80')) return '+3' + digits
  if (digits.length === 10 && digits.startsWith('0')) return '+38' + digits
  if (digits.length === 9) return '+380' + digits
  return null
}

/** National 9-digit subscriber number, if the input looks like a UA number in progress. */
function uaNationalDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('380')) return digits.slice(3, 12)
  if (digits.startsWith('80')) return digits.slice(2, 11)
  if (digits.startsWith('0')) return digits.slice(1, 10)
  return digits.slice(0, 9)
}

/**
 * Live input mask for Ukrainian mobiles: +380 XX XXX XX XX.
 * Accepts paste of 067…, 380…, +380… and always keeps the +380 prefix.
 */
export function formatUaPhoneInput(raw: string): string {
  const national = uaNationalDigits(raw)
  let out = '+380'
  if (national.length > 0) out += ' ' + national.slice(0, 2)
  if (national.length > 2) out += ' ' + national.slice(2, 5)
  if (national.length > 5) out += ' ' + national.slice(5, 7)
  if (national.length > 7) out += ' ' + national.slice(7, 9)
  return out
}

export function formatUaPhoneDisplay(phone: string): string {
  const n = normalizeUaPhone(phone)
  if (!n) return phone
  // +380 (XX) XXX-XX-XX
  const d = n.slice(1) // 380XXXXXXXXX
  return `+${d.slice(0, 3)} (${d.slice(3, 5)}) ${d.slice(5, 8)}-${d.slice(8, 10)}-${d.slice(10, 12)}`
}
