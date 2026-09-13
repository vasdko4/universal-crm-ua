// Block disposable mailboxes. Corporate and any other real domain is allowed.
// The check runs on the server (Better Auth hook) and is duplicated
// client-side for instant feedback.

export const ALLOWED_EMAIL_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'ukr.net',
  'i.ua',
  'meta.ua',
  'email.ua',
  'online.ua',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'yahoo.com',
  'proton.me',
  'protonmail.com',
  'zoho.com',
  'aol.com',
]

/** Well-known throwaway providers — not an exhaustive blocklist. */
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.org',
  '10minutemail.com',
  '10minutemail.net',
  'tempmail.com',
  'temp-mail.org',
  'throwawaymail.com',
  'yopmail.com',
  'trashmail.com',
  'getnada.com',
  'sharklasers.com',
  'grr.la',
  'discard.email',
  'mailnesia.com',
  'maildrop.cc',
  'fakeinbox.com',
  'tempail.com',
])

export function getEmailDomain(email: string): string | null {
  const at = email.lastIndexOf('@')
  if (at === -1) return null
  return email.slice(at + 1).trim().toLowerCase()
}

export function isAllowedEmailDomain(email: string): boolean {
  const domain = getEmailDomain(email)
  if (!domain) return false
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) return false
  const labels = domain.split('.')
  if (labels.length < 2) return false
  if (labels.some((part) => part.length === 0 || part.length > 63)) return false
  if (!/^[a-z0-9.-]+$/.test(domain)) return false
  return true
}

export const EMAIL_DOMAIN_ERROR =
  'Вкажіть справжню електронну пошту. Одноразові скриньки не приймаються.'
