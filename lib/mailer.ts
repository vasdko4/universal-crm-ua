import nodemailer from 'nodemailer'
import { getStoreSettingsInternal } from '@/lib/store-settings'

export type MailPayload = {
  to: string
  subject: string
  text: string
  html?: string
}

/**
 * Sends an email using the SMTP settings configured in the admin (Settings → Email).
 * When SMTP is not configured we fall back to logging the message so flows like
 * password recovery remain testable in preview/dev environments.
 */
export async function sendMail(payload: MailPayload): Promise<{ sent: boolean; fallback: boolean }> {
  const settings = await getStoreSettingsInternal()
  const email = (settings.emailSettings ?? {}) as Record<string, string | boolean>

  const configured = Boolean(email.enabled && email.smtpHost && email.smtpUser)
  if (!configured) {
    console.log(
      `[v0] Email not configured — fallback log.\nTo: ${payload.to}\nSubject: ${payload.subject}\n${payload.text}`,
    )
    return { sent: false, fallback: true }
  }

  // Anti-spam: the From address MUST match the authenticated SMTP account —
  // otherwise SPF/DKIM/DMARC alignment fails and providers junk the message.
  // A different "fromEmail" is honored only as Reply-To.
  const smtpUser = String(email.smtpUser)
  const fromEmail = String(email.fromEmail || smtpUser)
  const alignedFrom = fromEmail.toLowerCase() === smtpUser.toLowerCase() ? fromEmail : smtpUser
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
    // domains are a common spam-filter heuristic.
    messageId: `<${Date.now()}.${Math.random().toString(36).slice(2)}@${senderDomain}>`,
    headers: {
      // Transactional signal + easy opt-out lower the spam score.
      'X-Auto-Response-Suppress': 'OOF, AutoReply',
      'List-Unsubscribe': `<mailto:${alignedFrom}?subject=unsubscribe>`,
      'X-Entity-Ref-ID': `${Date.now()}`, // prevents Gmail threading/dedup surprises
    },
  })
  return { sent: true, fallback: false }
}
