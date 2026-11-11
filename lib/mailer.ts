import { randomBytes } from 'node:crypto'
import nodemailer from 'nodemailer'
import { getStoreSettingsInternal } from '@/lib/store-settings'
import { reportError } from '@/lib/server-errors'

export type MailPayload = {
  to: string
  subject: string
  text: string
  html?: string
  /**
   * Optional stable Message-ID local part (before the @). When provided
   * (outbox retries pass `outbox-<row id>`), the same Message-ID is reused
   * across retries, so a crash between SMTP accept and the 'sent' mark
   * produces one message in Gmail instead of a visible duplicate (audit
   * A14 — mitigation, not exactly-once: the second SMTP transaction still
   * happens). When omitted, a random local part is generated as before.
   */
  messageId?: string
}

/**
 * Sends an email using the SMTP settings configured in the admin (Settings → Email).
 * When SMTP is not configured we fall back to logging the message so flows like
 * password recovery remain testable in preview/dev environments.
 */
export async function sendMail(payload: MailPayload): Promise<{ sent: boolean; fallback: boolean }> {
  const settings = await getStoreSettingsInternal()
  const email = (settings.emailSettings ?? {}) as Record<string, string | boolean>

  // "Configured" here means only "we have enough SMTP settings to attempt a
  // send" — it is NOT the order-email kill-switch. The master toggle
  // (Settings → Email → "Email-сповіщення", emailSettings.enabled) is a
  // notification-policy flag, enforced at the order-email callers
  // (lib/notifications.ts, lib/delivery/sync-tracking.ts): confirmation,
  // shipped and delivery-status emails never reach sendMail while it is off.
  // It must stay out of this transport check — account emails (password
  // reset / verification codes in app/actions/shop-auth.ts and lib/auth.ts)
  // and the admin test email (app/actions/settings-store.ts) have to keep
  // working while order emails are off, and they do so exactly when a
  // password is saved. A host + user with neither the toggle nor a password
  // is not worth attempting (a no-password relay is covered by the toggle).
  const configured = Boolean(email.smtpHost && email.smtpUser && (email.enabled || email.smtpPassword))
  if (!configured) {
    if (process.env.NODE_ENV === 'production') {
      // Never dump message bodies to production logs — they can contain
      // password-recovery codes. Structured signal instead (no PII).
      await reportError('email.not-configured', new Error('SMTP not configured — email dropped'), {
        context: { subject: payload.subject },
      })
    } else {
      // Dev/preview only: keep the full dump so flows like password
      // recovery stay testable without an SMTP server.
      console.log(
        `[mailer] Email not configured — fallback log.\nTo: ${payload.to}\nSubject: ${payload.subject}\n${payload.text}`,
      )
    }
    return { sent: false, fallback: true }
  }

  // Anti-spam: the From address MUST match the authenticated SMTP account —
  // otherwise SPF/DKIM/DMARC alignment fails and providers junk the message.
  // A different "fromEmail" is honored only as Reply-To.
  // Exception: some providers (e.g. Resend) use a non-email SMTP username
  // like "resend" — in that case the From must be the configured fromEmail.
  const smtpUser = String(email.smtpUser)
  const fromEmail = String(email.fromEmail || smtpUser)
  const smtpUserIsEmail = smtpUser.includes('@')
  const alignedFrom =
    !smtpUserIsEmail || fromEmail.toLowerCase() === smtpUser.toLowerCase() ? fromEmail : smtpUser
  const replyTo = alignedFrom === fromEmail ? undefined : fromEmail
  const senderDomain = alignedFrom.split('@')[1] || 'localhost'

  // Optional DKIM signing (admin: Settings → Email). When the SMTP provider
  // does not sign outgoing mail (e.g. a bare VPS relay), a DKIM signature is
  // required for Gmail/Yahoo bulk-sender rules. Gmail/SendGrid SMTP already
  // sign, so these fields can stay empty there.
  const dkimSelector = String(email.dkimSelector || '').trim()
  const dkimPrivateKey = String(email.dkimPrivateKey || process.env.DKIM_PRIVATE_KEY || '').trim()
  const dkim =
    dkimSelector && dkimPrivateKey
      ? { domainName: senderDomain, keySelector: dkimSelector, privateKey: dkimPrivateKey }
      : undefined

  const transporter = nodemailer.createTransport({
    host: String(email.smtpHost),
    port: Number.parseInt(String(email.smtpPort || '587'), 10),
    secure: String(email.smtpPort) === '465',
    auth: { user: String(email.smtpUser), pass: String(email.smtpPassword || '') },
    // Never fall back to an unencrypted connection on port 587 (STARTTLS).
    requireTLS: String(email.smtpPort) !== '465',
    ...(dkim ? { dkim } : {}),
  })

  // Strip header-injection attempts: raw newlines in user-influenced values
  // could otherwise smuggle extra SMTP headers.
  const safeSubject = payload.subject.replace(/[\r\n]+/g, ' ').trim()
  const safeTo = payload.to.replace(/[\r\n]+/g, '').trim()

  await transporter.sendMail({
    from: `"${String(email.fromName || settings.storeName).replace(/["\r\n]/g, '')}" <${alignedFrom}>`,
    to: safeTo,
    replyTo,
    subject: safeSubject,
    text: payload.text,
    html: payload.html,
    // Return-Path (envelope MAIL FROM) aligned with From — required for
    // SPF alignment under DMARC.
    envelope: { from: alignedFrom, to: safeTo },
    // Message-ID on the sender's own domain: mismatched/missing Message-ID
    // domains are a common spam-filter heuristic. A caller-provided
    // messageId (outbox retries) is the stable local part; otherwise random.
    messageId: `<${payload.messageId ?? `${Date.now()}.${randomBytes(8).toString('hex')}`}@${senderDomain}>`,
    headers: {
      // Transactional signal + easy opt-out lower the spam score.
      'X-Auto-Response-Suppress': 'OOF, AutoReply',
      'List-Unsubscribe': `<mailto:${alignedFrom}?subject=unsubscribe>`,
      'X-Entity-Ref-ID': `${Date.now()}`, // prevents Gmail threading/dedup surprises
    },
  })
  return { sent: true, fallback: false }
}
