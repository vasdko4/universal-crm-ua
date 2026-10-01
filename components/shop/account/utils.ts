/** Small shared helpers for the customer account area. */

/** Two-letter initials from a display name, falling back to the email local part. */
export function initials(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase()
  return email.slice(0, 2).toUpperCase()
}

/** Format a date in the shop's timezone (Europe/Kyiv). */
export function formatKyivDate(value: string | Date | null, locale: 'uk' | 'ru'): string {
  if (!value) return ''
  return new Date(value).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'uk-UA', {
    timeZone: 'Europe/Kyiv',
  })
}

/** Format a date+time in the shop's timezone (Europe/Kyiv). */
export function formatKyivDateTime(value: string | Date | null, locale: 'uk' | 'ru'): string {
  if (!value) return ''
  return new Date(value).toLocaleString(locale === 'ru' ? 'ru-RU' : 'uk-UA', {
    timeZone: 'Europe/Kyiv',
  })
}
