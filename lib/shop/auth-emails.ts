/**
 * Branded transactional emails that carry a one-time code:
 * password-recovery OTP and email-verification code.
 *
 * Both share one template so auth mail looks like the rest of the store
 * (same header/footer language as the order emails in lib/order-messages.ts).
 */

export type AuthMailBranding = {
  storeName?: string
  siteUrl?: string
  logoUrl?: string | null
  supportEmail?: string | null
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function codeMailHtml(opts: {
  locale: 'uk' | 'ru'
  title: string
  intro: string
  code: string
  codeHint: string
  ignoreHint: string
  branding?: AuthMailBranding
}): string {
  const { locale, title, intro, code, codeHint, ignoreHint, branding = {} } = opts
  const storeName = branding.storeName || 'Наш магазин'
  const siteUrl = (branding.siteUrl || '').replace(/\/$/, '')
  const logoHtml = branding.logoUrl
    ? `<img src="${esc(branding.logoUrl)}" height="36" alt="${esc(storeName)}" style="display:block;max-height:36px;width:auto" />`
    : `<span style="font-size:20px;font-weight:700;color:#1a1a1a;letter-spacing:-0.02em">${esc(storeName)}</span>`
  const footerService =
    locale === 'ru'
      ? 'Это сервисное письмо — отвечать на него не нужно.'
      : 'Це службовий лист — відповідати на нього не потрібно.'

  return `<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f2">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${esc(title)} — ${esc(intro)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
  <tr><td style="padding:24px 28px;border-bottom:1px solid #ececea">
    ${siteUrl ? `<a href="${esc(siteUrl)}" style="text-decoration:none">${logoHtml}</a>` : logoHtml}
  </td></tr>
  <tr><td style="padding:28px">
    <h1 style="margin:0 0 8px;font-size:22px;line-height:1.3;color:#1a1a1a">${esc(title)}</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4a4a47">${esc(intro)}</p>
    <div style="font-size:34px;font-weight:800;letter-spacing:10px;text-indent:10px;background:#f4f4f2;border-radius:12px;padding:20px 16px;text-align:center;margin:8px 0 12px;color:#1a1a1a;font-family:'Courier New',monospace">${esc(code)}</div>
    <p style="margin:0 0 4px;font-size:14px;color:#4a4a47">${esc(codeHint)}</p>
    <p style="margin:12px 0 0;font-size:13px;color:#9a9a97">${esc(ignoreHint)}</p>
  </td></tr>
  <tr><td style="padding:18px 28px;background:#fafaf8;border-top:1px solid #ececea">
    <p style="margin:0 0 2px;font-size:13px;color:#6b6b68"><strong style="color:#1a1a1a">${esc(storeName)}</strong></p>
    ${branding.supportEmail ? `<p style="margin:0;font-size:13px;color:#6b6b68">Email: <a href="mailto:${esc(branding.supportEmail)}" style="color:#6b6b68">${esc(branding.supportEmail)}</a></p>` : ''}
    <p style="margin:8px 0 0;font-size:12px;color:#9a9a97">${esc(footerService)}</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

/** Password-recovery OTP email (better-auth `forget-password` flow). */
export function buildPasswordResetMail(
  locale: 'uk' | 'ru',
  otp: string,
  branding: AuthMailBranding = {},
): { subject: string; text: string; html: string } {
  const uk = locale !== 'ru'
  const subject = uk ? 'Код відновлення пароля' : 'Код восстановления пароля'
  const intro = uk
    ? 'Використайте цей код, щоб задати новий пароль.'
    : 'Используйте этот код, чтобы задать новый пароль.'
  const codeHint = uk ? 'Код діє 15 хвилин.' : 'Код действует 15 минут.'
  const ignoreHint = uk
    ? 'Якщо ви не запитували відновлення пароля — просто проігноруйте цей лист.'
    : 'Если вы не запрашивали восстановление пароля — просто проигнорируйте это письмо.'
  const text =
    `${subject}\n\n${intro}\n\n${otp}\n\n${codeHint}\n${ignoreHint}`
  const html = codeMailHtml({
    locale,
    title: subject,
    intro,
    code: otp,
    codeHint,
    ignoreHint,
    branding,
  })
  return { subject, text, html }
}
