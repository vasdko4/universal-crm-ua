/**
 * Which proof of current identity an email change requires, decided purely
 * from the account's credential shape. Google-linked accounts are blocked
 * outright (their email is the link to the Google identity — see
 * shop-auth.ts); credential accounts prove ownership with the current
 * password; accounts with no password credential (e.g. passwordless
 * sign-in) prove it with a code sent to the CURRENT email address.
 */
export type EmailChangeReauth = 'blocked' | 'password' | 'old-email-code'

export function requiredReauthForEmailChange(input: {
  google: boolean
  hasPassword: boolean
}): EmailChangeReauth {
  if (input.google) return 'blocked'
  return input.hasPassword ? 'password' : 'old-email-code'
}
