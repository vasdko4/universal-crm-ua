// Ukrainian phone normalization to +380XXXXXXXXX.
export function normalizeUaPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('380')) return '+' + digits
  if (digits.length === 11 && digits.startsWith('80')) return '+3' + digits
  if (digits.length === 10 && digits.startsWith('0')) return '+38' + digits
  if (digits.length === 9) return '+380' + digits
  return null
}

export function formatUaPhoneDisplay(phone: string): string {
  const n = normalizeUaPhone(phone)
  if (!n) return phone
  // +380 (XX) XXX-XX-XX
  const d = n.slice(1) // 380XXXXXXXXX
  return `+${d.slice(0, 3)} (${d.slice(3, 5)}) ${d.slice(5, 8)}-${d.slice(8, 10)}-${d.slice(10, 12)}`
}
