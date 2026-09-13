export const EMAIL_VERIFY_TTL_MINUTES = 15

export function isSixDigitCode(code: string): boolean {
  return /^\d{6}$/.test(code.trim())
}

export function emailVerificationMail(locale: 'uk' | 'ru', code: string): { subject: string; text: string } {
  const uk = locale !== 'ru'
  return {
    subject: uk ? 'Код підтвердження пошти' : 'Код подтверждения почты',
    text: uk
      ? `Ваш код підтвердження пошти: ${code}\n\nКод діє ${EMAIL_VERIFY_TTL_MINUTES} хвилин. Якщо ви не реєструвались — проігноруйте цей лист.`
      : `Ваш код подтверждения почты: ${code}\n\nКод действует ${EMAIL_VERIFY_TTL_MINUTES} минут. Если вы не регистрировались — проигнорируйте это письмо.`,
  }
}
