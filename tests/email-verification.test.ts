import { describe, it, expect } from 'vitest'
import { emailVerificationMail, isSixDigitCode, EMAIL_VERIFY_TTL_MINUTES } from '@/lib/shop/email-verification'

describe('email verification', () => {
  it('accepts a 6-digit code only', () => {
    expect(isSixDigitCode('123456')).toBe(true)
    expect(isSixDigitCode(' 123456 ')).toBe(true)
    expect(isSixDigitCode('12345')).toBe(false)
    expect(isSixDigitCode('abcdef')).toBe(false)
  })

  it('builds a uk/ru letter that includes the code and TTL', () => {
    const uk = emailVerificationMail('uk', '482910')
    expect(uk.subject).toBe('Код підтвердження пошти')
    expect(uk.text).toContain('482910')
    expect(uk.text).toContain(String(EMAIL_VERIFY_TTL_MINUTES))

    const ru = emailVerificationMail('ru', '482910')
    expect(ru.subject).toBe('Код подтверждения почты')
    expect(ru.text).toContain('482910')
  })
})
