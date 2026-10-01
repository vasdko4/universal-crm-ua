import { codeMailHtml, type AuthMailBranding } from '@/lib/shop/auth-emails'

export const EMAIL_VERIFY_TTL_MINUTES = 15

export function isSixDigitCode(code: string): boolean {
  return /^\d{6}$/.test(code.trim())
}

export function emailVerificationMail(
  locale: 'uk' | 'ru',
  code: string,
  branding: AuthMailBranding = {},
): { subject: string; text: string; html: string } {
  const uk = locale !== 'ru'
  const subject = uk ? 'Код підтвердження пошти' : 'Код подтверждения почты'
  const intro = uk
    ? 'Введіть цей код на сайті, щоб підтвердити вашу електронну пошту.'
    : 'Введите этот код на сайте, чтобы подтвердить вашу электронную почту.'
  const codeHint = uk
    ? `Код діє ${EMAIL_VERIFY_TTL_MINUTES} хвилин.`
    : `Код действует ${EMAIL_VERIFY_TTL_MINUTES} минут.`
  const ignoreHint = uk
    ? 'Якщо ви не реєструвались — проігноруйте цей лист.'
    : 'Если вы не регистрировались — проигнорируйте это письмо.'
  const text = uk
    ? `Ваш код підтвердження пошти: ${code}\n\nКод діє ${EMAIL_VERIFY_TTL_MINUTES} хвилин. Якщо ви не реєструвались — проігноруйте цей лист.`
    : `Ваш код подтверждения почты: ${code}\n\nКод действует ${EMAIL_VERIFY_TTL_MINUTES} минут. Если вы не регистрировались — проигнорируйте это письмо.`
  const html = codeMailHtml({
    locale,
    title: subject,
    intro,
    code,
    codeHint,
    ignoreHint,
    branding,
  })
  return { subject, text, html }
}
