// Registration is allowed only from well-known mail providers. This both
// blocks disposable/temporary mailboxes and enforces the "gmail + popular
// providers only" policy. The check runs on the server (Better Auth hook)
// and is duplicated client-side for instant feedback.

export const ALLOWED_EMAIL_DOMAINS = [
  // Google
  'gmail.com',
  'googlemail.com',
  // Ukrainian providers
  'ukr.net',
  'i.ua',
  'meta.ua',
  'email.ua',
  'online.ua',
  // Microsoft
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  // Apple
  'icloud.com',
  'me.com',
  'mac.com',
  // Others
  'yahoo.com',
  'proton.me',
  'protonmail.com',
  'zoho.com',
  'aol.com',
]

export function getEmailDomain(email: string): string | null {
  const at = email.lastIndexOf('@')
  if (at === -1) return null
  return email.slice(at + 1).trim().toLowerCase()
}

export function isAllowedEmailDomain(email: string): boolean {
  const domain = getEmailDomain(email)
  if (!domain) return false
  return ALLOWED_EMAIL_DOMAINS.includes(domain)
}

export const EMAIL_DOMAIN_ERROR =
  'Регистрация доступна только с почтой Gmail или других популярных сервисов (ukr.net, outlook.com, icloud.com и т.д.)'
