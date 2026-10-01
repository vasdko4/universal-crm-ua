import { describe, it, expect } from 'vitest'
import { buildPasswordResetMail, codeMailHtml } from '@/lib/shop/auth-emails'
import { emailVerificationMail } from '@/lib/shop/email-verification'

describe('password reset mail', () => {
  it('builds localized uk/ru letters with the OTP', () => {
    const uk = buildPasswordResetMail('uk', '482910', { storeName: 'Тест Маркет' })
    expect(uk.subject).toBe('Код відновлення пароля')
    expect(uk.text).toContain('482910')
    expect(uk.text).toContain('15 хвилин')
    expect(uk.html).toContain('482910')
    expect(uk.html).toContain('Тест Маркет')
    expect(uk.html).toContain('lang="uk"')

    const ru = buildPasswordResetMail('ru', '482910')
    expect(ru.subject).toBe('Код восстановления пароля')
    expect(ru.text).toContain('482910')
    expect(ru.text).toContain('15 минут')
    expect(ru.html).toContain('482910')
  })

  it('escapes the code and branding in HTML', () => {
    const mail = buildPasswordResetMail('uk', '<script>alert(1)</script>', {
      storeName: '<b>evil</b>',
    })
    expect(mail.html).not.toContain('<script>')
    expect(mail.html).toContain('&lt;script&gt;')
    expect(mail.html).not.toContain('<b>evil</b>')
  })
})

describe('codeMailHtml template', () => {
  it('links the logo to the site when siteUrl is given', () => {
    const html = codeMailHtml({
      locale: 'uk',
      title: 'T',
      intro: 'I',
      code: '123',
      codeHint: 'H',
      ignoreHint: 'G',
      branding: { siteUrl: 'https://shop.test', logoUrl: 'https://shop.test/logo.png' },
    })
    expect(html).toContain('href="https://shop.test"')
    expect(html).toContain('src="https://shop.test/logo.png"')
  })
})

describe('email verification mail html', () => {
  it('includes the code and store branding in HTML', () => {
    const mail = emailVerificationMail('uk', '482910', { storeName: 'Тест Маркет' })
    expect(mail.html).toContain('482910')
    expect(mail.html).toContain('Тест Маркет')
    // text version unchanged
    expect(mail.text).toContain('482910')
  })
})
